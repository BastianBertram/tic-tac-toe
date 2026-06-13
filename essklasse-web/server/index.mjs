/**
 * EssKlasse AI proxy — zero-dependency Node server.
 *
 * Holds the Anthropic API key server-side so it is never shipped to the
 * browser. The frontend posts only structured data; prompts are built here,
 * so the endpoints cannot be abused as an open relay for arbitrary prompts.
 *
 * Run:  node --env-file=.env server/index.mjs   (see .env.example)
 * Env:  ANTHROPIC_API_KEY (required), PORT (default 3001),
 *       ALLOWED_ORIGIN (default http://localhost:5173)
 */
import { createServer } from 'node:http';
import { handleAuth, getSessionUser, sessionDeviceState, claimSessionDevice } from './auth.mjs';
import { handleSettings } from './settings.mjs';
import { handleData, allocateNummer, accountStatus, ensureSeeded, findAngebot, markVersendet, angebotAnnehmen } from './data.mjs';
import { createPortal, resolvePortal } from './angebotPortal.mjs';
import { sendAngebot } from './mail.mjs';

const PORT           = Number(process.env.PORT ?? 3001);
// ALLOWED_ORIGIN ist in Produktion Pflicht (kein localhost-Fallback) — sonst
// würde eine Fehlkonfiguration Cookie-getragene Cross-Origin-Requests von
// localhost erlauben. In Dev bleibt der bequeme Vite-Default.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
const API_KEY        = process.env.ANTHROPIC_API_KEY ?? '';
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB — data URLs of photos/PDFs
const IS_PROD        = process.env.NODE_ENV === 'production';
// Client-Header-Identität (X-User-Email, Rollen-Switcher) wird NUR vertraut,
// wenn sie EXPLIZIT per EK_DEV_HEADERS=1 freigeschaltet ist — und niemals in
// Produktion. Fail-closed: ein Deployment, das versehentlich NODE_ENV nicht auf
// „production" setzt, vertraut dem Header trotzdem nicht (das Flag fehlt dort).
const DEV_HEADERS    = !IS_PROD && process.env.EK_DEV_HEADERS === '1';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Rate-Limit für die (kostenpflichtigen) AI-Routen ─────────────────────────
// Einfaches Fenster-Zählwerk pro Identität (E-Mail) bzw. IP. Schützt den
// Anthropic-Key vor Kosten-Abuse („Denial of Wallet").
const AI_RL_WINDOW_MS = 60_000;
const AI_RL_MAX       = 20;            // max. AI-Calls pro Fenster und Identität
const aiHits = new Map();              // key → { count, resetAt }
function aiRateLimited(key) {
  const now = Date.now();
  const e = aiHits.get(key);
  if (!e || e.resetAt < now) {
    // Abgelaufene Einträge aufräumen, damit die Map nicht unbegrenzt wächst.
    if (aiHits.size > 200) for (const [k, v] of aiHits) if (v.resetAt < now) aiHits.delete(k);
    aiHits.set(key, { count: 1, resetAt: now + AI_RL_WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > AI_RL_MAX;
}

// Öffentliches Kundenportal: striktes Rate-Limit pro IP (Token-Bruteforce/DoS-Schutz).
const PORTAL_RL_MAX = 30;
const portalHits = new Map();
function portalRateLimited(ip) {
  const now = Date.now();
  const e = portalHits.get(ip);
  if (!e || e.resetAt < now) {
    if (portalHits.size > 500) for (const [k, v] of portalHits) if (v.resetAt < now) portalHits.delete(k);
    portalHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  e.count += 1;
  return e.count > PORTAL_RL_MAX;
}

/** HTML-Escaping für server-gerenderte Portalseite (XSS-Schutz). */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const PUBLIC_BASE = process.env.EK_PUBLIC_BASE ?? `http://localhost:${PORT}`;

const euroFmt = (n) => Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/**
 * Server-gerenderte Kundenportal-Seite (kein Login). Zeigt AUSSCHLIESSLICH
 * kundenrelevante, freigegebene Felder — keine internen Notizen, keine objektId,
 * keine anderen Angebote. Alle dynamischen Werte werden HTML-escaped (XSS-Schutz).
 */
function renderPortalPage(a, token) {
  const pos = (Array.isArray(a.positionen) ? a.positionen : []).filter(p => !p.geloescht);
  const rows = pos.map(p => `<tr><td>${escapeHtml(p.bezeichnung)}</td><td class="r">${escapeHtml(String(p.menge))} ${escapeHtml(p.einheit)}</td><td class="r">${euroFmt(p.einzelpreis)}</td><td class="r">${p.rabattProzent ? escapeHtml(String(p.rabattProzent)) + '%' : '–'}</td><td class="r">${euroFmt(p.gesamt)}</td></tr>`).join('');
  const angenommen = a.status === 'angenommen';
  const versendet = a.status === 'versendet';
  const tEsc = encodeURIComponent(token);
  const aktion = angenommen
    ? `<div class="ok">✓ Angebot angenommen${a.signatur?.name ? ' von ' + escapeHtml(a.signatur.name) : ''}.</div>`
    : versendet
      ? `<div class="accept"><p>Mit der Annahme bestätigen Sie das Angebot verbindlich.</p>
           <input id="nm" type="text" placeholder="Ihr Name" maxlength="120" />
           <button id="btn" type="button">Angebot annehmen</button>
           <div id="msg"></div></div>
         <script>
           document.getElementById('btn').onclick=async function(){
             var n=document.getElementById('nm').value.trim();
             if(!n){document.getElementById('msg').textContent='Bitte Namen eingeben.';return;}
             this.disabled=true;
             try{var r=await fetch('/api/angebot/public/${tEsc}/annehmen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})});
               if(r.ok){location.reload();}else{document.getElementById('msg').textContent='Fehler bei der Annahme.';this.disabled=false;}
             }catch(e){document.getElementById('msg').textContent='Netzwerkfehler.';this.disabled=false;}
           };
         </script>`
      : `<div class="info">Dieses Angebot ist derzeit nicht zur Annahme verfügbar.</div>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Angebot ${escapeHtml(a.nummer)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#222}
h1{font-size:22px}.muted{color:#666;font-size:14px}table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:14px}.r{text-align:right}
.total{font-weight:800;font-size:18px;text-align:right;margin:8px 0}
.btn,button{display:inline-block;background:#b9770e;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:15px;cursor:pointer;text-decoration:none}
input{padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;width:100%;max-width:280px;margin:8px 0;box-sizing:border-box}
.ok{background:#e7f5ec;color:#2d8a4e;padding:14px;border-radius:8px;font-weight:700}
.accept,.info{margin-top:16px}#msg{color:#c0392b;margin-top:8px;font-size:14px}</style></head>
<body>
<h1>Angebot ${escapeHtml(a.nummer)}</h1>
<div class="muted">${escapeHtml(a.betreff || '')}</div>
<p>Für: <strong>${escapeHtml(a.kundeFirma || '')}</strong>${a.gueltigBis ? ` &middot; gültig bis ${escapeHtml(a.gueltigBis)}` : ''}</p>
<table><thead><tr><th>Position</th><th class="r">Menge</th><th class="r">Einzel</th><th class="r">Rabatt</th><th class="r">Gesamt</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total">Endpreis (netto): ${euroFmt(a.gesamtsumme)}</div>
<p><a class="btn" href="/api/angebot/public/${tEsc}/pdf" target="_blank">📄 PDF ansehen</a></p>
${aktion}
</body></html>`;
}

// ── Single-Device-Sessions ───────────────────────────────────────────────────
// Pro Nutzer ist nur EIN Gerät gleichzeitig aktiv. Ein neuer Login/Claim auf
// einem anderen Gerät verdrängt die bisherige Sitzung; das alte Gerät erhält
// danach 401 SESSION_SUPERSEDED und wird abgemeldet.
const activeDevice = new Map(); // email(lower) → deviceId

/** Client-Header-Identität NUR im Dev-Modus (Rollen-Switcher). In Produktion
 *  ist ausschließlich die authentifizierte Cookie-Session maßgeblich. */
function devEmailHeader(req) {
  return DEV_HEADERS ? (req.headers['x-user-email'] ?? null) : null;
}

function emailOf(req) {
  const u = getSessionUser(req);
  return String(u?.email ?? devEmailHeader(req) ?? '').toLowerCase() || null;
}
function claimDeviceHeader(email, deviceId) {
  if (!email || !deviceId) return false;
  activeDevice.set(email, deviceId);
  return true;
}
/** Beansprucht dieses Gerät als aktive Sitzung — bevorzugt über die signierte
 *  Cookie-Sitzung (kryptografische Gerätebindung), sonst Dev-Header-Fallback. */
function claimDevice(req) {
  if (claimSessionDevice(req)) return true;       // echte Sitzung → sid wird aktiv
  return claimDeviceHeader(emailOf(req), req.headers['x-device-id'] ?? null);
}
/** true, wenn das anfragende Gerät das aktuell aktive ist (oder noch keins gesetzt). */
function isCurrentDevice(req) {
  // Echte signierte Sitzung: Single-Device wird über die aktive sid erzwungen
  // (Geräte-ID ist kryptografisch ans Token gebunden, nicht fälschbar).
  const st = sessionDeviceState(req);
  if (st.hasSession) return st.active;
  // Dev-Header-Modus (kein Cookie): Fallback auf die geräte-Map.
  const email = emailOf(req);
  if (!email) return true;                        // unbekannt → nicht blockieren
  const cur = activeDevice.get(email);
  if (!cur) return true;                          // noch kein Gerät beansprucht
  return cur === (req.headers['x-device-id'] ?? null);
}

// ── Prompts (moved off the client) ──────────────────────────────────────────
const OCR_BELEG_SYSTEM = `Du bist ein präziser OCR-Assistent für Bewirtungsbelege der HWK Hannover / EssKlasse Catering & Gastronomie.

Das Dokument ist ein vorgedrucktes Bestellformular. Es enthält eine Tabelle mit vielen vorgedruckten Produktzeilen.
Jede Zeile hat Spalten für: Produktgruppe, Produkt, Einheit, Preis, Menge/Anzahl, Bestellt, Zurück.

WICHTIG: Extrahiere NUR Zeilen, bei denen eine Menge oder Anzahl handschriftlich oder gedruckt eingetragen wurde (Wert > 0).
Leere Zeilen ohne Mengeneintrag ignorieren.
Lies ALLE Seiten des Dokuments sorgfältig durch.

Weise jeder Position eine passende Kategorie zu aus: Heißgetränke, Kaltgetränke, Speisen/Snacks, Sonderbestellungen, Abräumservice, Buffetaufbau, Equipment, Sonstiges.

Felder die nicht erkennbar sind, weglassen.
Datumsformat: YYYY-MM-DD
Zeitformat: HH:MM (24h)

JSON-Schema:
{
  "besteller": "Name des Bestellers/Auftraggebers",
  "cateringDatumVon": "YYYY-MM-DD",
  "cateringDatumBis": "YYYY-MM-DD",
  "uhrzeitVon": "HH:MM",
  "uhrzeitBis": "HH:MM",
  "veranstaltung": "Anlass/Veranstaltung",
  "ort": "Ort",
  "raum": "Raum/Bereich",
  "personenzahl": 0,
  "konto": "Kontonummer",
  "kostenstelle": "Kostenstelle",
  "kostentraeger": "Kostenträger",
  "wuensche": "Sonstige Wünsche/Bemerkungen",
  "rechnungsanschriftFirma": "Firma der Rechnungsanschrift",
  "rechnungsanschriftZuHaenden": "Zu Händen (Ansprechpartner)",
  "rechnungsanschriftStrasse": "Straße und Hausnummer",
  "rechnungsanschriftPlzOrt": "PLZ und Ort",
  "rechnungsanschriftAnlass": "Anlass der Bewirtung (Rechnungsfeld)",
  "rechnungsanschriftTeilnehmer": 0,
  "rechnungsanschriftTelefon": "Telefon für Rückfragen",
  "positionen": [
    { "kategorie": "Speisen/Snacks", "bezeichnung": "Belegte Brötchen KAT 1", "einheit": "1/2", "preis": 2.59, "menge": 20 }
  ]
}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const AI_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
function contentBlockFromDataUrl(dataUrl) {
  const isPdf = String(dataUrl).startsWith('data:application/pdf');
  const base64 = String(dataUrl).split(',')[1] ?? '';
  let mediaType = String(dataUrl).split(';')[0].split(':')[1] ?? 'image/jpeg';
  if (isPdf) return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  // media_type gegen Allowlist prüfen (nicht ungeprüft vom Client an Anthropic durchreichen).
  if (!AI_IMAGE_TYPES.has(mediaType)) {
    const e = new Error('Nicht unterstützter Medientyp.'); e.status = 400; throw e;
  }
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
}

/** Parst die (Regex-extrahierte) JSON-Antwort des Modells; ungültiges JSON → 422. */
function parseAiJson(str) {
  try { return JSON.parse(str); }
  catch { const e = new Error('Antwort konnte nicht verarbeitet werden.'); e.status = 422; throw e; }
}

async function callClaude({ model, max_tokens, system, messages }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens, ...(system ? { system } : {}), messages }),
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`Anthropic API ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    ...extraHeaders,
  });
  res.end(body);
}

// ── Route handlers ────────────────────────────────────────────────────────────
async function ocrBeleg(body) {
  if (!body?.dataUrl) return { status: 400, payload: { error: 'dataUrl required' } };
  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: OCR_BELEG_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        contentBlockFromDataUrl(body.dataUrl),
        { type: 'text', text: 'Extrahiere alle Felder aus diesem Bewirtungsbeleg. Antworte nur mit dem JSON-Objekt, ohne Erklärungen.' },
      ],
    }],
  });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { status: 422, payload: { error: 'Kein JSON in der Antwort gefunden.' } };
  return { status: 200, payload: { data: parseAiJson(match[0]) } };
}

async function ocrAbschluss(body) {
  if (!body?.dataUrl) return { status: 400, payload: { error: 'dataUrl required' } };
  const positionen = Array.isArray(body.positionen) ? body.positionen : [];
  const posListe = positionen.map(p => `- "${p.bezeichnung}"`).join('\n');
  const prompt = `Du bist ein OCR-Assistent für Bewirtungsbelege der EssKlasse / HWK Hannover.

Analysiere diesen abgeschlossenen Bewirtungsbeleg und extrahiere für jede Position die tatsächlichen Mengen.

Die folgenden Positionen wurden bestellt:
${posListe}

Suche im Dokument nach den Spalten: Ausgeliefert, Zurück Voll, Zurück Leer, Berechnen, Pfand.
Ordne die gefundenen Werte den Positionen zu (Fuzzy-Matching auf Bezeichnung).
Felder die nicht erkennbar sind, weglassen.

Antworte NUR mit einem JSON-Array:
[
  { "bezeichnung": "exakt wie oben", "ausgeliefert": 2, "zurueckVoll": 0, "zurueckLeer": 1, "berechnen": 1, "pfand": 0 }
]`;
  const text = await callClaude({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: [contentBlockFromDataUrl(body.dataUrl), { type: 'text', text: prompt }] }],
  });
  const match = text.match(/\[[\s\S]*\]/);
  return { status: 200, payload: { data: match ? parseAiJson(match[0]) : [] } };
}

async function duplikat(body) {
  const beleg = body?.beleg;
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  if (!beleg || candidates.length === 0) return { status: 200, payload: { ids: [] } };

  const kandidatenText = candidates
    .map(c => `ID:${c.id} | Nr:${c.bestellungsnummer} | Rechnung:${c.rechnungsnummer ?? '-'} | Datum:${c.cateringDatumVon} | Veranstaltung:${c.veranstaltung ?? '-'} | Besteller:${c.besteller ?? '-'} | Ort:${c.ort ?? '-'} | Raum:${c.raum ?? '-'} | Kostenstelle:${c.kostenstelle ?? '-'} | Personen:${c.personenzahl}`)
    .join('\n');

  const prompt = `Du prüfst ob ein Bewirtungsbeleg ein Duplikat einer bereits abgerechneten Bewirtung ist.
Gib im Zweifel lieber zu viele als zu wenige Treffer zurück — der Buchhaltungs-User entscheidet dann selbst.

AKTUELLER BELEG (noch keine Rechnung):
Datum: ${beleg.cateringDatumVon}
Veranstaltung: ${beleg.veranstaltung ?? '-'}
Besteller: ${beleg.besteller ?? '-'}
Ort: ${beleg.ort ?? '-'}
Raum: ${beleg.raum ?? '-'}
Kostenstelle: ${beleg.kostenstelle ?? '-'}
Personen: ${beleg.personenzahl}

BEREITS ABGERECHNETE BELEGE:
${kandidatenText}

Antworte NUR mit einem JSON-Array der IDs von möglichen Duplikaten (leeres Array wenn keine):
["id1", "id2"]

Kriterien (eines davon reicht): gleiches Datum + ähnlicher Veranstaltungsname, oder gleiches Datum + gleicher Besteller, oder gleiches Datum + gleiche Kostenstelle.`;

  const text = await callClaude({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  const match = text.match(/\[[\s\S]*\]/);
  const ids = match ? parseAiJson(match[0]) : [];
  return { status: 200, payload: { ids } };
}

const ROUTES = {
  '/api/ai/ocr-beleg': ocrBeleg,
  '/api/ai/ocr-abschluss': ocrAbschluss,
  '/api/ai/duplikat': duplikat,
};

// ── Server ─────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Device-Id',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    });
    res.end();
    return;
  }

  const url = (req.url ?? '').split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    return send(res, 200, { ok: true });
  }

  // ── Öffentliches Kundenportal (kein Login; striktes IP-Rate-Limit) ──
  const portalPage = url.match(/^\/angebot\/([A-Za-z0-9_-]{16,64})$/);
  if (req.method === 'GET' && portalPage) {
    const ip = req.socket?.remoteAddress ?? 'unknown';
    if (portalRateLimited(ip)) { res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Zu viele Anfragen.'); }
    const entry = resolvePortal(portalPage[1]);
    const a = entry ? findAngebot(entry.angebotId) : null;
    res.writeHead(a ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(a
      ? renderPortalPage(a, portalPage[1])
      : '<!doctype html><html lang="de"><meta charset="utf-8"><body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:0 16px"><h1>Angebot nicht gefunden</h1><p>Dieser Link ist ungültig oder abgelaufen.</p></body></html>');
  }

  const portalPdf = url.match(/^\/api\/angebot\/public\/([A-Za-z0-9_-]{16,64})\/pdf$/);
  if (req.method === 'GET' && portalPdf) {
    const ip = req.socket?.remoteAddress ?? 'unknown';
    if (portalRateLimited(ip)) { res.writeHead(429); return res.end(); }
    const entry = resolvePortal(portalPdf[1]);
    if (!entry || typeof entry.pdfDataUrl !== 'string' || !entry.pdfDataUrl.startsWith('data:application/pdf')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
    }
    const buf = Buffer.from(entry.pdfDataUrl.split(',')[1] ?? '', 'base64');
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Angebot.pdf"', 'X-Content-Type-Options': 'nosniff' });
    return res.end(buf);
  }

  const portalAccept = url.match(/^\/api\/angebot\/public\/([A-Za-z0-9_-]{16,64})\/annehmen$/);
  if (req.method === 'POST' && portalAccept) {
    const ip = req.socket?.remoteAddress ?? 'unknown';
    if (portalRateLimited(ip)) return send(res, 429, { error: 'Zu viele Anfragen.' });
    const entry = resolvePortal(portalAccept[1]);
    if (!entry) return send(res, 404, { error: 'Ungültiger oder abgelaufener Link.' });
    // Schlanker Body erwartet (nur { name }); großes Payload früh abweisen.
    if (Number(req.headers['content-length'] ?? 0) > 8 * 1024) {
      return send(res, 413, { error: 'Payload too large' });
    }
    try {
      const body = await readJsonBody(req);
      const result = angebotAnnehmen(entry.angebotId, body?.name);
      return send(res, result.status, result.payload);
    } catch (e) {
      return send(res, e?.status ?? 400, { error: 'Bad request' });
    }
  }

  // ── Single-Device: dieses Gerät als aktives beanspruchen (Login) ──
  if (req.method === 'POST' && url === '/api/session/claim') {
    const ok = claimDevice(req);
    return send(res, ok ? 200 : 400, { ok });
  }

  // ── Konto-Status (für Sofort-Logout bei Deaktivierung / Geräte­wechsel) ──
  if (req.method === 'GET' && url === '/api/me') {
    if (!isCurrentDevice(req)) {
      return send(res, 401, { error: 'SESSION_SUPERSEDED' });
    }
    const user = getSessionUser(req);
    return send(res, 200, accountStatus({ user, devEmail: devEmailHeader(req) }));
  }

  // ── App-Einstellungen (Branding & Impressum) ──
  if (url === '/api/settings' && (req.method === 'GET' || req.method === 'PUT')) {
    try {
      const body = req.method === 'PUT' ? await readJsonBody(req) : null;
      const user = getSessionUser(req);
      const result = handleSettings(req.method, url, body, { user });
      return send(res, result.status, result.payload);
    } catch (e) {
      return send(res, e?.status ?? 400, { error: e?.message ?? 'Bad request' });
    }
  }

  // ── Atomare Nummernvergabe (Bestell-/Lead-Nummern) ──
  if (req.method === 'POST' && url === '/api/nummer') {
    const user = getSessionUser(req);
    // Auflösbare Identität zwingend (Session in Prod, gültiger Dev-Header in Dev).
    if (!accountStatus({ user, devEmail: devEmailHeader(req) }).authenticated) {
      return send(res, 401, { error: 'Anmeldung erforderlich.' });
    }
    if (!isCurrentDevice(req)) return send(res, 401, { error: 'SESSION_SUPERSEDED' });
    try {
      const body = await readJsonBody(req);
      const result = allocateNummer({ user, devEmail: devEmailHeader(req) }, body?.typ, body?.jahr);
      return send(res, result.status, result.payload);
    } catch (e) {
      return send(res, e?.status ?? 400, { error: e?.message ?? 'Bad request' });
    }
  }

  // ── Angebot versenden (authentifiziert): Portal-Token + Mail ──
  if (req.method === 'POST' && url === '/api/angebot/versenden') {
    const user = getSessionUser(req);
    if (!accountStatus({ user, devEmail: devEmailHeader(req) }).authenticated) {
      return send(res, 401, { error: 'Anmeldung erforderlich.' });
    }
    if (!isCurrentDevice(req)) return send(res, 401, { error: 'SESSION_SUPERSEDED' });
    try {
      const body = await readJsonBody(req);
      const pdf = body?.pdfDataUrl;
      if (pdf != null && (typeof pdf !== 'string' || !pdf.startsWith('data:application/pdf'))) {
        return send(res, 400, { error: 'Ungültiges PDF.' });
      }
      const ctx = { user, devEmail: devEmailHeader(req) };
      const von = user?.name ?? devEmailHeader(req) ?? 'Vertrieb';
      const vr = markVersendet(ctx, body?.angebotId, von);
      if (vr.status !== 200) return send(res, vr.status, vr.payload);
      const a = vr.payload.angebot;
      const token = createPortal({ angebotId: a.id, pdfDataUrl: pdf ?? null, gueltigBis: a.gueltigBis });
      const portalLink = `${PUBLIC_BASE}/angebot/${token}`;
      const to = (typeof body?.empfaenger === 'string' && body.empfaenger.trim()) || a.email || '';
      const mailOk = to ? await sendAngebot({ to, kundeFirma: a.kundeFirma, nummer: a.nummer, portalLink, pdfDataUrl: pdf ?? null }) : false;
      return send(res, 200, { ok: true, portalLink, empfaenger: to || null, mailOk });
    } catch (e) {
      return send(res, e?.status ?? 400, { error: e?.message ?? 'Bad request' });
    }
  }

  // ── App-Daten (Benutzer, Objekte, Belege, Sales) ──
  if (url.startsWith('/api/data/') && (req.method === 'GET' || req.method === 'PUT')) {
    const user = getSessionUser(req);
    // Auflösbare Identität zwingend: in Prod die signierte Session, in Dev ein
    // gültiger X-User-Email-Header (EK_DEV_HEADERS). Unbekannte Identität → 401
    // (symmetrisch zu Prod, fail-closed; kein 200 mit leeren Daten in Dev).
    if (!accountStatus({ user, devEmail: devEmailHeader(req) }).authenticated) {
      return send(res, 401, { error: 'Anmeldung erforderlich.' });
    }
    // Verdrängte Sitzung (anderes Gerät) → Zugriff verweigern.
    if (!isCurrentDevice(req)) {
      return send(res, 401, { error: 'SESSION_SUPERSEDED' });
    }
    try {
      const body = req.method === 'PUT' ? await readJsonBody(req) : null;
      const result = handleData(req.method, url, body, { user, devEmail: devEmailHeader(req) });
      if (!result) return send(res, 404, { error: 'Not found' });
      return send(res, result.status, result.payload);
    } catch (e) {
      return send(res, e?.status ?? 400, { error: e?.message ?? 'Bad request' });
    }
  }

  // ── Auth routes (no Anthropic key required) ──
  if (req.method === 'POST' && url.startsWith('/auth/')) {
    try {
      const body = await readJsonBody(req);
      const result = await handleAuth(url, body, req, { allowedOrigin: ALLOWED_ORIGIN });
      if (!result) return send(res, 404, { error: 'Not found' });
      const headers = result.setCookie ? { 'Set-Cookie': result.setCookie } : {};
      return send(res, result.status, result.payload, headers);
    } catch (e) {
      return send(res, e?.status ?? 400, { error: e?.message ?? 'Bad request' });
    }
  }

  // ── AI routes (require Anthropic key) ──
  const handler = ROUTES[url];
  if (req.method !== 'POST' || !handler) {
    return send(res, 404, { error: 'Not found' });
  }

  // Authentifizierung wie bei /api/data: nur eingeloggte Nutzer (Prod: Session,
  // Dev: gültiger Header) dürfen die kostenpflichtigen AI-Endpunkte auslösen.
  if (!accountStatus({ user: getSessionUser(req), devEmail: devEmailHeader(req) }).authenticated) {
    return send(res, 401, { error: 'Anmeldung erforderlich.' });
  }
  if (!isCurrentDevice(req)) {
    return send(res, 401, { error: 'SESSION_SUPERSEDED' });
  }
  // Kosten-Schutz: Rate-Limit pro Identität (sonst IP).
  const rlKey = emailOf(req) ?? (req.socket?.remoteAddress ?? 'unknown');
  if (aiRateLimited(rlKey)) {
    return send(res, 429, { error: 'Zu viele Anfragen. Bitte kurz warten.' });
  }

  if (!API_KEY) {
    return send(res, 503, { error: 'AI_NOT_CONFIGURED' });
  }

  try {
    const body = await readJsonBody(req);
    const { status, payload } = await handler(body);
    return send(res, status, payload);
  } catch (e) {
    // Upstream-Detail nur serverseitig (Dev) loggen — generische Meldung an den Client.
    if (!IS_PROD) console.error('[ai] Upstream-Fehler:', e?.message);
    return send(res, e?.status ?? 502, { error: 'Verarbeitung fehlgeschlagen.' });
  }
});

// ── Produktions-Konfigurationsprüfung (fail-fast) ────────────────────────────
// In Produktion MÜSSEN die sicherheitskritischen Variablen gesetzt sein. Lieber
// gar nicht starten als unsicher/fehlerhaft laufen.
if (IS_PROD) {
  const fehler = [];
  if (!process.env.EK_AUTH_SECRET || process.env.EK_AUTH_SECRET.length < 32) {
    fehler.push('EK_AUTH_SECRET fehlt oder ist < 32 Zeichen (signiert die Sitzungstoken).');
  }
  if (!ALLOWED_ORIGIN) {
    fehler.push('ALLOWED_ORIGIN fehlt (CORS-Origin des Frontends, z.B. https://app.example.de).');
  }
  if (!API_KEY) {
    // AI-Funktionen wären deaktiviert (503) — Warnung, kein harter Abbruch.
    console.warn('[config] WARN: ANTHROPIC_API_KEY nicht gesetzt — AI-Funktionen sind deaktiviert.');
  }
  if (fehler.length) {
    console.error('[config] FATAL: Produktionsstart abgebrochen — fehlende/ungültige Konfiguration:');
    for (const f of fehler) console.error('  • ' + f);
    console.error('  Siehe .env.example. Start z.B.: NODE_ENV=production EK_AUTH_SECRET=… ALLOWED_ORIGIN=… npm start');
    process.exit(1);
  }
}

ensureSeeded(); // Stammdaten anlegen, damit kein öffentlicher Bootstrap nötig ist
server.listen(PORT, () => {
  console.log(`EssKlasse AI proxy listening on http://localhost:${PORT}`);
  console.log(`  mode:           ${IS_PROD ? 'production' : 'development'}`);
  console.log(`  allowed origin: ${ALLOWED_ORIGIN || '(none)'}`);
  console.log(`  AI configured:  ${Boolean(API_KEY)}`);
});

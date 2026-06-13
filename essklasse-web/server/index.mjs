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
import { handleAuth, getSessionUser } from './auth.mjs';
import { handleSettings } from './settings.mjs';
import { handleData, accountStatus, ensureSeeded } from './data.mjs';

const PORT           = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const API_KEY        = process.env.ANTHROPIC_API_KEY ?? '';
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB — data URLs of photos/PDFs
const IS_PROD        = process.env.NODE_ENV === 'production';
// Client-Header-Identität (X-User-Email, Rollen-Switcher) wird NUR vertraut,
// wenn sie EXPLIZIT per EK_DEV_HEADERS=1 freigeschaltet ist — und niemals in
// Produktion. Fail-closed: ein Deployment, das versehentlich NODE_ENV nicht auf
// „production" setzt, vertraut dem Header trotzdem nicht (das Flag fehlt dort).
const DEV_HEADERS    = !IS_PROD && process.env.EK_DEV_HEADERS === '1';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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
function claimDevice(email, deviceId) {
  if (!email || !deviceId) return false;
  activeDevice.set(email, deviceId);
  return true;
}
/** true, wenn das anfragende Gerät das aktuell aktive ist (oder noch keins gesetzt). */
function isCurrentDevice(req) {
  const email = emailOf(req);
  if (!email) return true;                       // unbekannt → nicht blockieren
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
function contentBlockFromDataUrl(dataUrl) {
  const isPdf = String(dataUrl).startsWith('data:application/pdf');
  const base64 = String(dataUrl).split(',')[1] ?? '';
  const mediaType = String(dataUrl).split(';')[0].split(':')[1] ?? 'image/jpeg';
  return isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
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
  return { status: 200, payload: { data: JSON.parse(match[0]) } };
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
  return { status: 200, payload: { data: match ? JSON.parse(match[0]) : [] } };
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
  const ids = match ? JSON.parse(match[0]) : [];
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
    return send(res, 200, { ok: true, aiConfigured: Boolean(API_KEY) });
  }

  // ── Single-Device: dieses Gerät als aktives beanspruchen (Login) ──
  if (req.method === 'POST' && url === '/api/session/claim') {
    const ok = claimDevice(emailOf(req), req.headers['x-device-id'] ?? null);
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

  // ── App-Daten (Benutzer, Objekte, Belege, Sales) ──
  if (url.startsWith('/api/data/') && (req.method === 'GET' || req.method === 'PUT')) {
    const user = getSessionUser(req);
    // Außerhalb des expliziten Dev-Header-Modus ist eine authentifizierte
    // Sitzung zwingend (fail-closed, gilt auch bei versehentlich fehlendem
    // NODE_ENV=production).
    if (!DEV_HEADERS && !user) {
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
      const result = handleAuth(url, body, req, { allowedOrigin: ALLOWED_ORIGIN });
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

  if (!API_KEY) {
    return send(res, 503, { error: 'AI_NOT_CONFIGURED' });
  }

  try {
    const body = await readJsonBody(req);
    const { status, payload } = await handler(body);
    return send(res, status, payload);
  } catch (e) {
    const status = e?.status ?? 502;
    return send(res, status, { error: e?.message ?? 'Upstream error' });
  }
});

ensureSeeded(); // Stammdaten anlegen, damit kein öffentlicher Bootstrap nötig ist
server.listen(PORT, () => {
  console.log(`EssKlasse AI proxy listening on http://localhost:${PORT}`);
  console.log(`  allowed origin: ${ALLOWED_ORIGIN}`);
  console.log(`  AI configured:  ${Boolean(API_KEY)}`);
});

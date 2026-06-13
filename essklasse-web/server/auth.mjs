/**
 * Magic-link auth — produktionsgehärtet (zero-dependency).
 *
 * Vertrag, den das Frontend spricht:
 *   POST /auth/login   { email }            → verschickt einen One-Time-Link, 200
 *   POST /auth/verify  { token } + X-Device-Id → setzt signiertes Sitzungs-Cookie
 *   POST /auth/refresh (cookie)             → rotiert/erneuert die Sitzung
 *   POST /auth/logout  (cookie)             → widerruft die Sitzung
 *
 * Härtung gegenüber dem früheren Scaffold:
 *   - Sitzungs-/Access-Token ist ein HMAC-SHA256-signiertes Token (kein
 *     ungeprüfter Zufallsstring) und wird auf jeder Route verifiziert.
 *   - Sitzungen liegen in einem persistenten Store (server/data/sessions.json)
 *     statt nur im RAM → überleben Neustarts, sind serverseitig widerrufbar.
 *   - Die Geräte-ID (`did`) ist KRYPTOGRAFISCH an die Sitzung gebunden: sie
 *     steckt in der signierten Payload und im Session-Datensatz. Ein Client kann
 *     sie nicht fälschen; „nur ein Gerät gleichzeitig" wird über die aktive sid
 *     je Konto erzwungen.
 *
 * Verbleibend für echten Betrieb: One-Time-Magic-Tokens noch im RAM (kurzlebig,
 * 15 min) und der Versand per `console.log` statt echtem Mailprovider.
 */
import { randomBytes, createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountStatus, getUsers, getObjekte } from './data.mjs';
import { sendMagicLink } from './mail.mjs';

const MAGIC_TTL_MS   = 15 * 60 * 1000;            // 15 min, one-time
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const COOKIE_NAME    = 'ek_refresh';
const IS_PROD        = process.env.NODE_ENV === 'production';
const ALLE_MARKER    = '__alle__';
const DATA_DIR       = join(dirname(fileURLToPath(import.meta.url)), 'data');
const STORE_FILE     = join(DATA_DIR, 'sessions.json');
const MAGIC_FILE     = join(DATA_DIR, 'magic.json');

// ── Signier-Geheimnis ────────────────────────────────────────────────────────
// In Produktion ZWINGEND per EK_AUTH_SECRET (>=32 Zeichen) gesetzt; fehlt es,
// werden keine Sitzungen ausgestellt (fail-closed). In Dev ephemerer Schlüssel.
const SECRET = (() => {
  const s = process.env.EK_AUTH_SECRET;
  if (typeof s === 'string' && s.length >= 32) return s;
  if (IS_PROD) {
    console.error('[auth] FATAL: EK_AUTH_SECRET (>=32 Zeichen) ist in Produktion erforderlich — Sitzungen sind deaktiviert.');
    return null;
  }
  console.warn('[auth] EK_AUTH_SECRET nicht gesetzt — ephemeres Dev-Geheimnis (Sitzungen werden bei Server-Neustart ungültig).');
  return randomBytes(32).toString('hex');
})();

// ── Token: base64url(payload).base64url(hmac) ────────────────────────────────
const b64url    = buf => Buffer.from(buf).toString('base64url');
const fromB64url = str => Buffer.from(str, 'base64url');

function sign(payload) {
  if (!SECRET) return null;
  const body = b64url(JSON.stringify(payload));
  const sig  = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!SECRET || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest();
  let given;
  try { given = fromB64url(sig); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ── Persistenter Sitzungs-Store ──────────────────────────────────────────────
// { byId: { sid: { email, did, exp } }, activeByEmail: { email: sid } }
let store = (() => {
  try {
    const s = JSON.parse(readFileSync(STORE_FILE, 'utf8'));
    const byId = s.byId ?? {};
    const now = Date.now();
    for (const [sid, rec] of Object.entries(byId)) if (!rec || rec.exp < now) delete byId[sid];
    return { byId, activeByEmail: s.activeByEmail ?? {} };
  } catch { return { byId: {}, activeByEmail: {} }; }
})();

function saveStore() {
  try {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
  } catch (e) { console.error('[auth] Sitzungs-Store konnte nicht gespeichert werden:', e?.message); }
}

function newId() { return randomBytes(32).toString('hex'); }

/** Erzeugt eine neue Sitzung, bindet das Gerät, supersedet ältere Geräte. */
function createSession(email, deviceId) {
  if (!SECRET) return null;
  const sid = newId();
  const exp = Date.now() + SESSION_TTL_MS;
  const did = String(deviceId ?? '') || newId(); // ohne Client-Device-Id: serverseitige ID
  store.byId[sid] = { email, did, exp };
  store.activeByEmail[email] = sid;              // „nur ein Gerät": neue Sitzung verdrängt alte
  saveStore();
  return sign({ sid, sub: email, did, iat: Date.now(), exp });
}

/** Liest & validiert die Sitzung aus dem Cookie. Gibt { sid, email, did } oder null. */
function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyToken(token);
  if (!payload) return null;
  const rec = store.byId[payload.sid];
  if (!rec || rec.exp < Date.now()) { if (rec) { delete store.byId[payload.sid]; saveStore(); } return null; }
  // Signierte Werte müssen mit dem Server-Datensatz übereinstimmen (Anti-Tamper).
  if (rec.email !== payload.sub || rec.did !== payload.did) return null;
  return { sid: payload.sid, email: rec.email, did: rec.did };
}

// ── Benutzer-/Objektquelle (dieselbe wie die Autorisierung) ──────────────────
function findUser(email) {
  const norm = String(email ?? '').trim().toLowerCase();
  return getUsers().find(u => String(u.email ?? '').toLowerCase() === norm) ?? null;
}

function objekteForUser(user) {
  const objekte = getObjekte();
  const ids = Array.isArray(user.objektIds) ? user.objektIds : [];
  if (user.rolle === 'admin' || user.rolle === 'geschaeftsfuehrung' || ids.includes(ALLE_MARKER)) {
    return objekte;
  }
  return objekte.filter(o => ids.includes(o.id)); // leere Zuordnung = keine Objekte
}

// ── Magic-Token-Store (persistent, gehasht) ─────────────────────────────────
// Es wird NUR der SHA-256-Hash des One-Time-Tokens gespeichert — bei einem Leak
// der Datei sind keine gültigen Links rekonstruierbar. Persistenz überlebt
// Server-Neustarts (ein angeforderter Link bleibt 15 min gültig).
const magicHash = token => createHash('sha256').update(String(token)).digest('hex');

let magic = (() => {
  try {
    const m = JSON.parse(readFileSync(MAGIC_FILE, 'utf8'));
    const byHash = m.byHash ?? {};
    const now = Date.now();
    for (const [h, rec] of Object.entries(byHash)) if (!rec || rec.expiresAt < now) delete byHash[h];
    return { byHash };
  } catch { return { byHash: {} }; }
})();

function saveMagic() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(MAGIC_FILE, JSON.stringify(magic), 'utf8');
  } catch (e) { console.error('[auth] Magic-Token-Store konnte nicht gespeichert werden:', e?.message); }
}

function sessionPayload(user, token) {
  return {
    accessToken: token, // signiertes, verifiziertes Token (kein Scaffold mehr)
    user: { id: user.id, name: user.name, email: user.email, rolle: user.rolle, objektIds: user.objektIds },
    objekte: objekteForUser(user),
  };
}

// ── Cookie helpers ───────────────────────────────────────────────────────────
export function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function buildSetCookie(value, { clear = false } = {}) {
  const attrs = [
    `${COOKIE_NAME}=${clear ? '' : value}`,
    'HttpOnly',
    'Path=/',
    IS_PROD ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${clear ? 0 : Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (IS_PROD) attrs.push('Secure'); // HTTPS required for SameSite=None
  return attrs.join('; ');
}

const deviceIdOf = req => String(req.headers['x-device-id'] ?? '') || null;

// ── Handlers ──────────────────────────────────────────────────────────────────
async function login(body, _req, { allowedOrigin }) {
  const user = findUser(body?.email);
  // Immer 200, damit der Endpunkt nicht verrät, welche Adressen existieren.
  if (!user) {
    console.log(`[auth] login requested for unknown email: ${body?.email}`);
    return { status: 200, payload: { ok: true } };
  }
  const token = newId();
  magic.byHash[magicHash(token)] = { email: user.email, expiresAt: Date.now() + MAGIC_TTL_MS };
  saveMagic();
  const link = `${allowedOrigin}/?token=${token}`;
  // Zustellung über den konfigurierbaren Mail-Adapter (Webhook in Prod, Log in Dev).
  await sendMagicLink({ to: user.email, link });
  // In Dev den Link zusätzlich zurückgeben, damit er ohne Mailprovider testbar ist.
  return { status: 200, payload: IS_PROD ? { ok: true } : { ok: true, devLink: link } };
}

function verify(body, req) {
  if (!SECRET) return { status: 500, payload: { error: 'Server-Authentifizierung nicht konfiguriert.' } };
  const h = body?.token ? magicHash(body.token) : null;
  const entry = h ? magic.byHash[h] : null;
  if (!entry || entry.expiresAt < Date.now()) {
    if (h && magic.byHash[h]) { delete magic.byHash[h]; saveMagic(); }
    return { status: 401, payload: { error: 'Link ungültig oder abgelaufen.' } };
  }
  delete magic.byHash[h]; saveMagic(); // one-time use
  const user = findUser(entry.email);
  if (!user) return { status: 401, payload: { error: 'Konto nicht gefunden.' } };
  const st = accountStatus({ devEmail: user.email });
  if (st.authenticated && !st.active) {
    return { status: 403, payload: { error: 'Konto deaktiviert. Bitte wenden Sie sich an Ihren Administrator.' } };
  }
  const token = createSession(user.email, deviceIdOf(req));
  return { status: 200, payload: sessionPayload(user, token), setCookie: buildSetCookie(token) };
}

function refresh(_body, req) {
  const s = getSession(req);
  if (!s) return { status: 401, payload: { error: 'Keine gültige Sitzung.' } };
  const user = findUser(s.email);
  if (!user) return { status: 401, payload: { error: 'Konto nicht gefunden.' } };
  const st = accountStatus({ devEmail: user.email });
  if (st.authenticated && !st.active) {
    delete store.byId[s.sid];
    if (store.activeByEmail[s.email] === s.sid) delete store.activeByEmail[s.email];
    saveStore();
    return { status: 403, payload: { error: 'Konto deaktiviert.' }, setCookie: buildSetCookie('', { clear: true }) };
  }
  // Rotieren: neues Token mit verlängerter Gültigkeit, Gerät bleibt gebunden.
  const exp = Date.now() + SESSION_TTL_MS;
  store.byId[s.sid] = { email: s.email, did: s.did, exp };
  saveStore();
  const token = sign({ sid: s.sid, sub: s.email, did: s.did, iat: Date.now(), exp });
  return { status: 200, payload: sessionPayload(user, token), setCookie: buildSetCookie(token) };
}

function logout(_body, req) {
  const s = getSession(req);
  if (s) {
    delete store.byId[s.sid];
    if (store.activeByEmail[s.email] === s.sid) delete store.activeByEmail[s.email];
    saveStore();
  }
  return { status: 200, payload: { ok: true }, setCookie: buildSetCookie('', { clear: true }) };
}

const HANDLERS = {
  '/auth/login': login,
  '/auth/verify': verify,
  '/auth/refresh': refresh,
  '/auth/logout': logout,
};

/** Eingeloggten Nutzer aus der signierten Cookie-Sitzung auflösen, sonst null. */
export function getSessionUser(req) {
  const s = getSession(req);
  if (!s) return null;
  return findUser(s.email);
}

/**
 * Geräte-/Sitzungsstatus für die Single-Device-Prüfung.
 * @returns { hasSession, active, email }
 */
export function sessionDeviceState(req) {
  const s = getSession(req);
  if (!s) return { hasSession: false, active: false, email: null };
  return { hasSession: true, active: store.activeByEmail[s.email] === s.sid, email: s.email };
}

/** Macht die aktuelle (cookie-) Sitzung zum aktiven Gerät; verdrängt andere. */
export function claimSessionDevice(req) {
  const s = getSession(req);
  if (!s) return false;
  store.activeByEmail[s.email] = s.sid;
  saveStore();
  return true;
}

/** Returns { status, payload, setCookie? } or null if `url` is not an auth route. */
export async function handleAuth(url, body, req, ctx) {
  const handler = HANDLERS[url];
  if (!handler) return null;
  return (await handler(body, req, ctx)) ?? { status: 500, payload: { error: 'auth handler error' } };
}

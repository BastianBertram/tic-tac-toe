/**
 * Magic-link auth — SCAFFOLD / DEV-GRADE.
 *
 * Implements the contract the frontend already speaks:
 *   POST /auth/login   { email }            → emails a one-time link, 200
 *   POST /auth/verify  { token }            → sets refresh cookie, returns session
 *   POST /auth/refresh (cookie)             → returns a fresh session
 *   POST /auth/logout  (cookie)             → clears the refresh cookie
 *
 * NOT production-ready. Before shipping real auth, replace:
 *   - the in-memory `users` table        → your real user store / DB
 *   - the in-memory token/session Maps    → a persistent store (Redis/DB)
 *   - the console.log "email"             → a real transactional email provider
 *   - accessToken (random string)         → a signed, short-lived JWT that
 *                                            protected routes actually verify
 *   - SameSite=Lax cookie                 → SameSite=None; Secure over HTTPS
 *     (and gate protected /api routes on the access token)
 */
import { randomBytes } from 'node:crypto';
import { accountStatus } from './data.mjs';

const MAGIC_TTL_MS   = 15 * 60 * 1000;            // 15 min, one-time
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const COOKIE_NAME    = 'ek_refresh';
const IS_PROD        = process.env.NODE_ENV === 'production';

// ── Demo data (replace with a real user/objekt store) ────────────────────────
const OBJEKTE = [
  { id: 'demo-1', name: 'HWK Hannover Hauptgebäude', kuerzel: 'HWK-01', strasse: 'Berliner Allee 17', plz: '30175', ort: 'Hannover', kostenstellen: ['KST-100'], aktiv: true },
  { id: 'demo-2', name: 'Berufsschulzentrum Nord',   kuerzel: 'BSZ-N',  strasse: 'Podbielskistr. 22', plz: '30163', ort: 'Hannover', kostenstellen: ['KST-200'], aktiv: true },
];

const USERS = [
  { id: 'demo-admin',  name: 'Max Mustermann', email: 'max@hwk-hannover.de',          rolle: 'admin',       objektIds: [] },
  { id: 'demo-user-1', name: 'Anna Schmidt',   email: 'anna@hwk-hannover.de',         rolle: 'user',        objektIds: ['demo-1'] },
  { id: 'demo-buch-1', name: 'Klaus Weber',    email: 'buchhaltung@hwk-hannover.de',  rolle: 'buchhaltung', objektIds: [] },
];

function findUser(email) {
  const norm = String(email ?? '').trim().toLowerCase();
  return USERS.find(u => u.email.toLowerCase() === norm) ?? null;
}

function objekteForUser(user) {
  if (!user.objektIds || user.objektIds.length === 0) return OBJEKTE; // admin/buchhaltung: alle
  return OBJEKTE.filter(o => user.objektIds.includes(o.id));
}

// ── In-memory stores (swap for a DB in production) ───────────────────────────
const magicTokens = new Map(); // token → { email, expiresAt }
const sessions    = new Map(); // refreshToken → { email, expiresAt }

function newToken() {
  return randomBytes(32).toString('hex');
}

function sessionPayload(user) {
  return {
    accessToken: newToken(), // scaffold: not yet verified on protected routes
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

// ── Handlers ──────────────────────────────────────────────────────────────────
function login(body, _req, { allowedOrigin }) {
  const user = findUser(body?.email);
  // Always respond 200 so the endpoint never reveals which emails exist.
  if (!user) {
    console.log(`[auth] login requested for unknown email: ${body?.email}`);
    return { status: 200, payload: { ok: true } };
  }
  const token = newToken();
  magicTokens.set(token, { email: user.email, expiresAt: Date.now() + MAGIC_TTL_MS });
  const link = `${allowedOrigin}/?token=${token}`;

  // TODO: send `link` via a real email provider. For dev we log it.
  console.log(`[auth] magic link for ${user.email}:\n  ${link}`);

  // In dev, also return the link so it's testable without an email provider.
  return { status: 200, payload: IS_PROD ? { ok: true } : { ok: true, devLink: link } };
}

function verify(body) {
  const entry = magicTokens.get(body?.token);
  if (!entry || entry.expiresAt < Date.now()) {
    magicTokens.delete(body?.token);
    return { status: 401, payload: { error: 'Link ungültig oder abgelaufen.' } };
  }
  magicTokens.delete(body.token); // one-time use
  const user = findUser(entry.email);
  if (!user) return { status: 401, payload: { error: 'Konto nicht gefunden.' } };
  // Vom Admin deaktivierte Konten dürfen sich nicht einloggen.
  if (!accountStatus({ devEmail: user.email }).active) {
    return { status: 403, payload: { error: 'Konto deaktiviert. Bitte wenden Sie sich an Ihren Administrator.' } };
  }

  const refresh = newToken();
  sessions.set(refresh, { email: user.email, expiresAt: Date.now() + SESSION_TTL_MS });
  return { status: 200, payload: sessionPayload(user), setCookie: buildSetCookie(refresh) };
}

function refresh(_body, req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const entry = token && sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return { status: 401, payload: { error: 'Keine gültige Sitzung.' } };
  }
  const user = findUser(entry.email);
  if (!user) return { status: 401, payload: { error: 'Konto nicht gefunden.' } };
  // Während einer laufenden Sitzung deaktiviert → Sitzung beenden.
  if (!accountStatus({ devEmail: user.email }).active) {
    sessions.delete(token);
    return { status: 403, payload: { error: 'Konto deaktiviert.' }, setCookie: buildSetCookie('', { clear: true }) };
  }
  return { status: 200, payload: sessionPayload(user) };
}

function logout(_body, req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) sessions.delete(token);
  return { status: 200, payload: { ok: true }, setCookie: buildSetCookie('', { clear: true }) };
}

const HANDLERS = {
  '/auth/login': login,
  '/auth/verify': verify,
  '/auth/refresh': refresh,
  '/auth/logout': logout,
};

/** Resolves the logged-in user from the refresh cookie, or null. */
export function getSessionUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const entry = token && sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return findUser(entry.email);
}

/** Returns { status, payload, setCookie? } or null if `url` is not an auth route. */
export function handleAuth(url, body, req, ctx) {
  const handler = HANDLERS[url];
  if (!handler) return null;
  return handler(body, req, ctx) ?? { status: 500, payload: { error: 'auth handler error' } };
}

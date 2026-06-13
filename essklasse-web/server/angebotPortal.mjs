/**
 * Kundenportal-Token-Store für Angebote (zero-dependency).
 *
 * Beim Versenden eines Angebots wird ein unguessbarer Zufalls-Token erzeugt und
 * dem Kunden als Link geschickt. Serverseitig wird NUR der SHA-256-Hash des
 * Tokens gespeichert (wie bei Magic-Links) — der Klartext-Token existiert nur im
 * Link. Der Token bindet an genau EIN Angebot und ist rein lesend (plus Annahme).
 *
 * Persistenz: data/angebot_portal.json. Enthält das gerenderte PDF (data-URL),
 * damit der Kunde es ohne Login abrufen kann.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, 'data');
const FILE      = join(DATA_DIR, 'angebot_portal.json');

const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(readFileSync(FILE, 'utf8')); }
  catch { cache = { tokens: {} }; }
  if (!cache.tokens) cache.tokens = {};
  return cache;
}
function persist() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * Legt einen Portal-Token für ein Angebot an (ersetzt einen evtl. vorhandenen
 * für dasselbe Angebot — nur EIN aktiver Link je Angebot). Gibt den KLARTEXT-
 * Token zurück (nur hier verfügbar; gespeichert wird nur der Hash).
 */
export function createPortal({ angebotId, pdfDataUrl, gueltigBis }) {
  const db = load();
  // Alten Token desselben Angebots entfernen (Rotation).
  for (const [h, e] of Object.entries(db.tokens)) {
    if (e.angebotId === angebotId) delete db.tokens[h];
  }
  const token = randomBytes(24).toString('base64url'); // 32 Zeichen, unguessbar
  db.tokens[hashToken(token)] = {
    angebotId,
    pdfDataUrl: typeof pdfDataUrl === 'string' ? pdfDataUrl : null,
    gueltigBis: gueltigBis || null,
    erstelltAm: new Date().toISOString(),
  };
  persist();
  return token;
}

/** Löst einen Klartext-Token auf. Liefert den Eintrag oder null (auch bei Ablauf). */
export function resolvePortal(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const db = load();
  const entry = db.tokens[hashToken(token)];
  if (!entry) return null;
  // Ablauf: nach Gültigkeitsdatum (Ende des Tages) ist der Link tot.
  if (entry.gueltigBis && entry.gueltigBis < new Date().toISOString().slice(0, 10)) return null;
  return entry;
}

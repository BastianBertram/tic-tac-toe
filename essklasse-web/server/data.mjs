/**
 * Generischer, serverseitig persistierter Daten-Store für die App-Kollektionen
 * (Benutzer, Objekte, Belege, Sales) — damit alle Nutzer denselben Stand sehen.
 *
 *   GET /api/data/<collection>   → { initialized, data }
 *   PUT /api/data/<collection>   → speichert `data` (Body) und gibt es zurück
 *
 * Gating (nur in Produktion; in Dev offen wie der Auth-Scaffold):
 *   - users, objekte → nur Admin darf schreiben
 *   - belege, sales  → jeder eingeloggte Nutzer darf schreiben
 *
 * Hinweis: bewusst schlank (eine JSON-Datei je Kollektion, „ganze Kollektion
 * ersetzen"). Für echten Mehrbenutzerbetrieb gehört das auf eine DB mit
 * Pro-Datensatz-Endpunkten und Konfliktauflösung.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, 'data');
const IS_PROD   = process.env.NODE_ENV === 'production';

/** write: 'admin' = nur Admin, 'auth' = jeder eingeloggte Nutzer */
const COLLECTIONS = {
  users:   { write: 'admin', default: { users: [] } },
  objekte: { write: 'admin', default: { objekte: [] } },
  belege:  { write: 'auth',  default: { belege: [], bestellungZaehler: {} } },
  sales:   { write: 'auth',  default: { anfragen: [], leadZaehler: {} } },
};

const cache = new Map(); // name → data

function fileFor(name) {
  return join(DATA_DIR, `${name}.json`);
}

function load(name) {
  if (cache.has(name)) return { initialized: true, data: cache.get(name) };
  const file = fileFor(name);
  if (!existsSync(file)) {
    return { initialized: false, data: COLLECTIONS[name].default };
  }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    cache.set(name, data);
    return { initialized: true, data };
  } catch {
    return { initialized: false, data: COLLECTIONS[name].default };
  }
}

function persist(name, data) {
  cache.set(name, data);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(fileFor(name), JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Behandelt /api/data/<collection>.
 * @param ctx { user } – eingeloggter Nutzer (oder null) für die Schreibrechte-Prüfung
 * @returns { status, payload } oder null, wenn keine Daten-Route
 */
export function handleData(method, url, body, ctx = {}) {
  const m = url.match(/^\/api\/data\/([a-z]+)$/);
  if (!m) return null;
  const name = m[1];
  const cfg = COLLECTIONS[name];
  if (!cfg) return { status: 404, payload: { error: 'Unknown collection' } };

  if (method === 'GET') {
    return { status: 200, payload: load(name) };
  }

  if (method === 'PUT') {
    if (IS_PROD) {
      const user = ctx.user;
      if (cfg.write === 'admin' && user?.rolle !== 'admin') {
        return { status: 403, payload: { error: 'Nur Admins dürfen diese Daten ändern.' } };
      }
      if (cfg.write === 'auth' && !user) {
        return { status: 401, payload: { error: 'Anmeldung erforderlich.' } };
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, payload: { error: 'Body muss ein Objekt sein.' } };
    }
    persist(name, body);
    return { status: 200, payload: { initialized: true, data: body } };
  }

  return { status: 405, payload: { error: 'Method not allowed' } };
}

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
/**
 * Ermittelt den Objekt-Geltungsbereich des anfragenden Nutzers.
 * Quelle ist der im Admin verwaltete Benutzer-Datensatz (users.json); die
 * Identität kommt aus der Session (Cookie) oder – als Dev-Fallback – aus dem
 * Header `X-User-Email`.
 * @returns { restricted: boolean, objektIds: string[] }
 *   restricted=true nur für die Rollen `user`/`bereichsleitung`.
 */
/** Ermittelt den persistierten Benutzer-Datensatz (users.json) des Anfragenden. */
function resolveIdentity(ctx) {
  const users = load('users').data?.users ?? [];
  if (ctx.user) {
    const rec = users.find(u =>
      u.id === ctx.user.id ||
      String(u.email ?? '').toLowerCase() === String(ctx.user.email ?? '').toLowerCase());
    return rec ?? ctx.user;
  }
  if (ctx.devEmail) {
    const mail = String(ctx.devEmail).toLowerCase();
    return users.find(u => String(u.email ?? '').toLowerCase() === mail) ?? null;
  }
  return null;
}

/** Status des Kontos: authentifiziert? aktiv? */
export function accountStatus(ctx) {
  const idn = resolveIdentity(ctx);
  return { authenticated: !!idn, active: idn ? idn.aktiv !== false : true };
}

function userScope(ctx) {
  const users = load('users').data?.users ?? [];
  let identity = resolveIdentity(ctx);
  if (!identity) return { restricted: false, objektIds: [] };
  // Admin & Geschäftsführung: voller, objektübergreifender Zugriff.
  if (identity.rolle === 'admin' || identity.rolle === 'geschaeftsfuehrung') {
    return { restricted: false, objektIds: [] };
  }
  // Alle übrigen Rollen sind auf ihre vom Admin zugeordneten Objekte beschränkt
  // (leere Zuordnung = keine Objekte). Maßgeblich ist die users.json (Admin).
  const rec = users.find(u =>
    u.id === identity.id ||
    String(u.email ?? '').toLowerCase() === String(identity.email ?? '').toLowerCase());
  const objektIds = rec?.objektIds ?? identity.objektIds ?? [];
  // Marker „__alle__" = vom Admin allen Objekten zugeordnet → Vollzugriff.
  if (objektIds.includes('__alle__')) return { restricted: false, objektIds: [] };
  return { restricted: true, objektIds };
}

export function handleData(method, url, body, ctx = {}) {
  const m = url.match(/^\/api\/data\/([a-z]+)$/);
  if (!m) return null;
  const name = m[1];
  const cfg = COLLECTIONS[name];
  if (!cfg) return { status: 404, payload: { error: 'Unknown collection' } };

  // Deaktivierte Konten verlieren sofort jeden Datenzugriff.
  if (!accountStatus(ctx).active) {
    return { status: 403, payload: { error: 'ACCOUNT_DEACTIVATED' } };
  }

  if (method === 'GET') {
    const env = load(name);
    // Belege bzw. Objekte nur für die dem Nutzer zugeordneten Objekte ausliefern.
    if (name === 'belege' || name === 'objekte') {
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        if (name === 'belege') {
          const alle = Array.isArray(env.data?.belege) ? env.data.belege : [];
          return { status: 200, payload: {
            initialized: env.initialized,
            data: { ...env.data, belege: alle.filter(b => ids.has(b.objektId)) },
          } };
        }
        const alle = Array.isArray(env.data?.objekte) ? env.data.objekte : [];
        return { status: 200, payload: {
          initialized: env.initialized,
          data: { ...env.data, objekte: alle.filter(o => ids.has(o.id)) },
        } };
      }
    }
    return { status: 200, payload: env };
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

    // Deaktivierung ist endgültig: ein einmal deaktivierter Benutzer ist
    // eingefroren — weder reaktivierbar noch anderweitig bearbeitbar (auch
    // nicht per Direkt-API). Sein bestehender Datensatz bleibt unverändert.
    if (name === 'users') {
      const vorher = Array.isArray(load(name).data?.users) ? load(name).data.users : [];
      const inaktiv = new Map(vorher.filter(u => u.aktiv === false).map(u => [u.id, u]));
      const users = Array.isArray(body.users)
        ? body.users.map(u => inaktiv.has(u.id) ? inaktiv.get(u.id) : u)
        : body.users;
      const merged = { ...body, users };
      persist(name, merged);
      return { status: 200, payload: { initialized: true, data: merged } };
    }

    // Eingeschränkte Nutzer dürfen Objekte nicht verändern → Stand bewahren,
    // Antwort auf den eigenen Geltungsbereich beschränken.
    if (name === 'objekte') {
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const existing = load(name).data ?? COLLECTIONS.objekte.default;
        const alle = Array.isArray(existing.objekte) ? existing.objekte : [];
        return { status: 200, payload: {
          initialized: true,
          data: { ...existing, objekte: alle.filter(o => ids.has(o.id)) },
        } };
      }
    }

    // Eingeschränkte Nutzer dürfen nur Belege ihrer Objekte schreiben; Belege
    // anderer Objekte bleiben unangetastet (Merge statt vollständigem Ersetzen).
    if (name === 'belege') {
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const bestehend = Array.isArray(load(name).data?.belege) ? load(name).data.belege : [];
        const fremde    = bestehend.filter(b => !ids.has(b.objektId));      // unverändert lassen
        const eigenAlt  = bestehend.filter(b => ids.has(b.objektId));
        let eigenNeu    = Array.isArray(body.belege) ? body.belege.filter(b => ids.has(b.objektId)) : [];
        // Schutz: ein leerer Eigen-Push (z.B. uninitialisierter Client) darf die
        // bereits vorhandenen Belege des Nutzers nicht versehentlich löschen.
        if (eigenNeu.length === 0 && eigenAlt.length > 0) eigenNeu = eigenAlt;
        const mergedZaehler = mergeZaehler(load(name).data?.bestellungZaehler, body.bestellungZaehler);
        const merged = { ...load(name).data, ...body, belege: [...fremde, ...eigenNeu], bestellungZaehler: mergedZaehler };
        persist(name, merged);
        // Antwort wieder auf den Geltungsbereich beschränken.
        return { status: 200, payload: { initialized: true, data: { ...merged, belege: eigenNeu } } };
      }
    }

    persist(name, body);
    return { status: 200, payload: { initialized: true, data: body } };
  }

  return { status: 405, payload: { error: 'Method not allowed' } };
}

/** Führt zwei Bestellungszähler zusammen (höchster Wert je Jahr gewinnt). */
function mergeZaehler(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = Math.max(Number(out[k] ?? 0), Number(v ?? 0));
  }
  return out;
}

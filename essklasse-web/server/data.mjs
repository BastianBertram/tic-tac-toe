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
import { SEED_USERS, SEED_OBJEKTE } from './seed.mjs';

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
 * Stellt beim Serverstart sicher, dass die Stammdaten-Kollektionen
 * (users/objekte) angelegt und nicht leer sind. Dadurch ist kein öffentlicher
 * „Bootstrap"-Schreibzugriff nötig — der Admin-Write-Gate gilt ausnahmslos.
 * Bestehende, befüllte Dateien werden NICHT überschrieben.
 */
export function ensureSeeded() {
  const usersOk = existsSync(fileFor('users')) && (load('users').data?.users ?? []).length > 0;
  if (!usersOk) persist('users', { users: SEED_USERS });
  const objekteOk = existsSync(fileFor('objekte')) && (load('objekte').data?.objekte ?? []).length > 0;
  if (!objekteOk) persist('objekte', { objekte: SEED_OBJEKTE });
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
 *   Unrestricted (Vollzugriff) nur für `admin`/`geschaeftsfuehrung` ODER wenn der
 *   Admin den Marker `__alle__` zugewiesen hat (z.B. Buchhaltung „Alle Objekte").
 *   Alle übrigen Rollen sind restricted; leere `objektIds` = keine Objekte.
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

/** Status des Kontos: authentifiziert? aktiv? (fail-closed: unbekannt = inaktiv) */
export function accountStatus(ctx) {
  const idn = resolveIdentity(ctx);
  return { authenticated: !!idn, active: idn ? idn.aktiv !== false : false };
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

  // Authentifizierte, aber deaktivierte Konten verlieren sofort jeden Zugriff.
  const status = accountStatus(ctx);
  if (status.authenticated && !status.active) {
    return { status: 403, payload: { error: 'ACCOUNT_DEACTIVATED' } };
  }

  if (method === 'GET') {
    const env = load(name);
    // Benutzerliste nur für Admin/GF vollständig. Eingeschränkte Nutzer erhalten
    // ausschließlich Kollegen, mit denen sie sich mindestens ein Objekt teilen
    // (plus sich selbst) — keine app-weite Offenlegung aller Stammdaten.
    if (name === 'users') {
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const ich = resolveIdentity(ctx);
        const alle = Array.isArray(env.data?.users) ? env.data.users : [];
        const sichtbar = alle.filter(u =>
          (ich && (u.id === ich.id ||
            String(u.email ?? '').toLowerCase() === String(ich.email ?? '').toLowerCase())) ||
          (Array.isArray(u.objektIds) && u.objektIds.some(oid => ids.has(oid))));
        return { status: 200, payload: {
          initialized: env.initialized,
          data: { ...env.data, users: sichtbar },
        } };
      }
    }
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
    // Autorisierung anhand der EINEN Rollenquelle (resolveIdentity → users.json),
    // konsistent zum Lese-Scoping. Admin-Schreibrechte (users/objekte) werden in
    // Dev wie Prod AUSNAHMSLOS erzwungen — Stammdaten werden serverseitig geseedet
    // (ensureSeeded), daher ist kein öffentlicher Bootstrap-Schreibzugriff nötig.
    const identity = resolveIdentity(ctx);
    if (cfg.write === 'admin' && identity?.rolle !== 'admin') {
      return { status: 403, payload: { error: 'Nur Admins dürfen diese Daten ändern.' } };
    }
    // Auth-Schreibrechte (belege/sales) sind in Produktion zwingend.
    if (IS_PROD && cfg.write === 'auth' && !identity) {
      return { status: 401, payload: { error: 'Anmeldung erforderlich.' } };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, payload: { error: 'Body muss ein Objekt sein.' } };
    }
    // Datenintegrität: ein bestehender Stammdatenbestand darf nicht durch eine
    // leere ODER ungültige (Nicht-Array, z.B. null/{}) Liste gelöscht werden.
    if (name === 'users' || name === 'objekte') {
      const vorhanden = Array.isArray(load(name).data?.[name]) ? load(name).data[name] : [];
      const eingehend = body[name];
      if (vorhanden.length > 0 && (!Array.isArray(eingehend) || eingehend.length === 0)) {
        return { status: 400, payload: { error: 'Ungültige oder leere Stammdatenliste.' } };
      }
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
      // Aussperr-Schutz: es muss immer mindestens ein aktiver Admin übrig bleiben,
      // sonst könnten die Stammdaten danach von niemandem mehr verwaltet werden.
      const aktiveAdminsVorher = vorher.filter(u => u.rolle === 'admin' && u.aktiv !== false).length;
      const aktiveAdminsNachher = Array.isArray(users)
        ? users.filter(u => u.rolle === 'admin' && u.aktiv !== false).length
        : 0;
      if (aktiveAdminsVorher > 0 && aktiveAdminsNachher === 0) {
        return { status: 400, payload: { error: 'Mindestens ein aktiver Administrator muss erhalten bleiben.' } };
      }
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

    // Belege werden NIE physisch gelöscht (auch nicht die eines deaktivierten
    // Nutzers): bestehende Datensätze bleiben erhalten, eingehende aktualisieren
    // bzw. ergänzen sie nur (id-erhaltend). So bleiben sie im System und für
    // andere Nutzer desselben Objekts zugreifbar.
    if (name === 'belege') {
      const cur = load(name).data ?? COLLECTIONS.belege.default;
      const bestehend = Array.isArray(cur.belege) ? cur.belege : [];
      const mergedZaehler = mergeZaehler(cur.bestellungZaehler, body.bestellungZaehler);
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const fremde    = bestehend.filter(b => !ids.has(b.objektId));   // andere Objekte: unangetastet
        const eigenAlt  = bestehend.filter(b => ids.has(b.objektId));
        // IDs, die bereits einem Fremdobjekt gehören, dürfen NICHT vom
        // eingeschränkten Nutzer (um)geschrieben werden – sonst entstünde ein
        // ID-Duplikat, das eine spätere id-erhaltende Operation kollidieren ließe.
        const fremdeIds = new Set(fremde.map(b => b.id));
        const eingehend = (Array.isArray(body.belege) ? body.belege : [])
          .filter(b => ids.has(b.objektId) && !fremdeIds.has(b.id));
        const eigenNeu  = mergeById(eigenAlt, eingehend);               // eigene Objekte: nur ergänzen/aktualisieren
        const merged = { ...cur, ...body, belege: [...fremde, ...eigenNeu], bestellungZaehler: mergedZaehler };
        persist(name, merged);
        return { status: 200, payload: { initialized: true, data: { ...merged, belege: eigenNeu } } };
      }
      // Admin/GF: voller Zugriff, aber ebenfalls id-erhaltend (kein Hard-Delete).
      const merged = { ...cur, ...body, belege: mergeById(bestehend, Array.isArray(body.belege) ? body.belege : []), bestellungZaehler: mergedZaehler };
      persist(name, merged);
      return { status: 200, payload: { initialized: true, data: merged } };
    }

    // Sales-Anfragen werden ebenfalls nie physisch gelöscht (id-erhaltend).
    if (name === 'sales') {
      const cur = load(name).data ?? COLLECTIONS.sales.default;
      const bestehend = Array.isArray(cur.anfragen) ? cur.anfragen : [];
      const merged = {
        ...cur, ...body,
        anfragen: mergeById(bestehend, Array.isArray(body.anfragen) ? body.anfragen : []),
        leadZaehler: mergeZaehler(cur.leadZaehler, body.leadZaehler),
      };
      persist(name, merged);
      return { status: 200, payload: { initialized: true, data: merged } };
    }

    persist(name, body);
    return { status: 200, payload: { initialized: true, data: body } };
  }

  return { status: 405, payload: { error: 'Method not allowed' } };
}

/** Führt zwei Datensatz-Listen id-erhaltend zusammen: bestehende bleiben
 *  erhalten, eingehende aktualisieren (gleiche id) oder ergänzen sie. */
function mergeById(existing = [], incoming = [], key = 'id') {
  const map = new Map(existing.map(r => [r[key], r]));
  for (const r of incoming) map.set(r[key], r);
  return [...map.values()];
}

/** Führt zwei Zähler zusammen (höchster Wert je Schlüssel gewinnt). */
function mergeZaehler(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = Math.max(Number(out[k] ?? 0), Number(v ?? 0));
  }
  return out;
}

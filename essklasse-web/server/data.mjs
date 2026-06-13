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

/** Vollzugriffs-Marker in `objektIds` (vom Admin gesetzt). Reservierte ID —
 *  darf NIE eine echte Objekt-ID sein. */
const ALLE_OBJEKTE_MARKER = '__alle__';

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

/** Stammdaten-Zugriff für die Auth-Schicht — EINE Quelle (users.json/Seed). */
export function getUsers()   { return load('users').data?.users ?? []; }
export function getObjekte() { return load('objekte').data?.objekte ?? []; }

/** Status des Kontos: authentifiziert? aktiv? (fail-closed: unbekannt = inaktiv) */
export function accountStatus(ctx) {
  const idn = resolveIdentity(ctx);
  return { authenticated: !!idn, active: idn ? idn.aktiv !== false : false };
}

function userScope(ctx) {
  const users = load('users').data?.users ?? [];
  let identity = resolveIdentity(ctx);
  // Fail-closed: unbekannte/fehlende Identität erhält KEINEN Zugriff (restricted,
  // keine Objekte) — konsistent mit accountStatus. In Produktion werden solche
  // Anfragen ohnehin vorher per 401 abgewiesen; dies ist Defense-in-Depth.
  if (!identity) return { restricted: true, objektIds: [] };
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
  if (objektIds.includes(ALLE_OBJEKTE_MARKER)) return { restricted: false, objektIds: [] };
  return { restricted: true, objektIds };
}

/**
 * Server-seitige, atomare Nummernvergabe (verhindert Doppelnummern bei
 * gleichzeitiger Erstellung auf mehreren Geräten). Node ist single-threaded:
 * Lesen→+1→Schreiben innerhalb dieses Handlers (ohne await) ist atomar.
 * Zähler sind pro Jahr (zweistellig), nicht pro Objekt — eine gemeinsame Sequenz.
 */
const NUMMERN = {
  bestellung: { collection: 'belege', zaehlerKey: 'bestellungZaehler', prefix: 'A', pad: 7 },
  lead:       { collection: 'sales',  zaehlerKey: 'leadZaehler',       prefix: 'L', pad: 4 },
};

export function allocateNummer(ctx, typ, jahr) {
  const cfg = NUMMERN[typ];
  if (!cfg) return { status: 400, payload: { error: 'Unbekannter Nummerntyp.' } };
  if (!/^\d{2}$/.test(String(jahr ?? ''))) return { status: 400, payload: { error: 'Ungültiges Jahr (erwartet zweistellig, z.B. "26").' } };
  const status = accountStatus(ctx);
  if (status.authenticated && !status.active) return { status: 403, payload: { error: 'ACCOUNT_DEACTIVATED' } };

  const data = load(cfg.collection).data ?? COLLECTIONS[cfg.collection].default;
  const zaehler = { ...(data[cfg.zaehlerKey] ?? {}) };
  const naechste = (Number(zaehler[jahr]) || 0) + 1;
  zaehler[jahr] = naechste;
  persist(cfg.collection, { ...data, [cfg.zaehlerKey]: zaehler });
  const nummer = `${cfg.prefix}${jahr}${String(naechste).padStart(cfg.pad, '0')}`;
  return { status: 200, payload: { nummer, wert: naechste, jahr, typ } };
}

/** Nicht-sensible Anzeigefelder eines Benutzers (für eingeschränkte Rollen). */
function projektUser(u) {
  return {
    id: u.id, name: u.name, anrede: u.anrede, vorname: u.vorname, nachname: u.nachname,
    rolle: u.rolle, aktiv: u.aktiv,
  };
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
      const ich = resolveIdentity(ctx);
      // Vollständige Personen-Records NUR für Admin/Geschäftsführung. Die Feld-
      // Whitelist ist ROLLEN-basiert (nicht restricted-basiert): auch Rollen mit
      // `__alle__`-Vollzugriff (z.B. Buchhaltung) erhalten keine E-Mail/Telefon/
      // objektIds/erstelltAm der Kollegen — Datensparsamkeit/DSGVO.
      if (ich?.rolle !== 'admin' && ich?.rolle !== 'geschaeftsfuehrung') {
        const scope = userScope(ctx);
        const alle = Array.isArray(env.data?.users) ? env.data.users : [];
        // restricted → nur Kollegen mit gemeinsamem Objekt + sich selbst;
        // `__alle__`-Vollzugriff → alle Nutzer, aber ebenfalls reduzierte Felder.
        const ids = new Set(scope.objektIds);
        const sichtbar = (scope.restricted
          ? alle.filter(u =>
              (ich && (u.id === ich.id ||
                String(u.email ?? '').toLowerCase() === String(ich.email ?? '').toLowerCase())) ||
              (Array.isArray(u.objektIds) && u.objektIds.some(oid => ids.has(oid))))
          : alle
        ).map(projektUser);
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
    // Sales-Anfragen (Leads) sind mandantengetrennt: nur die der zugeordneten
    // Objekte ausliefern. Admin/GF (unrestricted) erhalten alle.
    if (name === 'sales') {
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const alle = Array.isArray(env.data?.anfragen) ? env.data.anfragen : [];
        return { status: 200, payload: {
          initialized: env.initialized,
          data: { ...env.data, anfragen: alle.filter(a => ids.has(a.objektId)) },
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
    // Die ID „__alle__" ist als Vollzugriffs-Marker in objektIds reserviert und
    // darf NIE als echte Objekt-ID existieren — sonst kollabierte die Trennung
    // zwischen „ein Objekt" und „alle Objekte" (siehe userScope/objekteForUser).
    if (name === 'objekte' && Array.isArray(body.objekte) &&
        body.objekte.some(o => o?.id === ALLE_OBJEKTE_MARKER)) {
      return { status: 400, payload: { error: `Die Objekt-ID „${ALLE_OBJEKTE_MARKER}" ist reserviert.` } };
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
      // Self-Lockout-Schutz: der ANFRAGENDE Admin muss im Ergebnis weiterhin
      // aktiver Admin sein. Verhindert (versehentliche oder feindliche)
      // Selbst-Herabstufung/-Deaktivierung des handelnden Admins.
      if (identity?.rolle === 'admin' && Array.isArray(users)) {
        const ich = users.find(u =>
          u.id === identity.id ||
          String(u.email ?? '').toLowerCase() === String(identity.email ?? '').toLowerCase());
        if (!ich || ich.rolle !== 'admin' || ich.aktiv === false) {
          return { status: 400, payload: { error: 'Sie können Ihre eigenen Administratorrechte nicht entziehen.' } };
        }
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
        // Bestell-Zähler ist pro Jahr (nicht pro Objekt) und wird per Max gemerged
        // (kann nicht verkleinert werden) — daher kein Objekt-Scoping.
        const zaehler = mergeZaehler(cur.bestellungZaehler, body.bestellungZaehler);
        // Nur whitelistete Top-Level-Felder persistieren — KEIN ...body-Spread,
        // damit ein eingeschränkter Nutzer keine beliebigen Keys in die geteilte
        // Kollektion schreiben kann.
        const merged = { ...cur, belege: [...fremde, ...eigenNeu], bestellungZaehler: zaehler };
        persist(name, merged);
        return { status: 200, payload: { initialized: true, data: { ...merged, belege: eigenNeu } } };
      }
      // Admin/GF: voller Zugriff, aber ebenfalls id-erhaltend (kein Hard-Delete);
      // ebenfalls nur whitelistete Felder.
      const zaehler = mergeZaehler(cur.bestellungZaehler, body.bestellungZaehler);
      const merged = { ...cur, belege: mergeById(bestehend, Array.isArray(body.belege) ? body.belege : []), bestellungZaehler: zaehler };
      persist(name, merged);
      return { status: 200, payload: { initialized: true, data: merged } };
    }

    // Sales-Anfragen werden ebenfalls nie physisch gelöscht (id-erhaltend);
    // mandantengetrennt wie Belege (Objekt-Scope) + nur whitelistete Felder.
    if (name === 'sales') {
      const cur = load(name).data ?? COLLECTIONS.sales.default;
      const bestehend = Array.isArray(cur.anfragen) ? cur.anfragen : [];
      const scope = userScope(ctx);
      if (scope.restricted) {
        const ids = new Set(scope.objektIds);
        const fremde    = bestehend.filter(a => !ids.has(a.objektId));   // andere Objekte: unangetastet
        const eigenAlt  = bestehend.filter(a => ids.has(a.objektId));
        const fremdeIds = new Set(fremde.map(a => a.id));
        const eingehend = (Array.isArray(body.anfragen) ? body.anfragen : [])
          .filter(a => ids.has(a.objektId) && !fremdeIds.has(a.id));     // keine fremden IDs/Objekte
        const eigenNeu  = mergeById(eigenAlt, eingehend);
        // Lead-Zähler ist pro Jahr (nicht pro Objekt) und wird per Max gemerged
        // (kann nicht verkleinert werden) — daher kein Objekt-Scoping.
        const zaehler   = mergeZaehler(cur.leadZaehler, body.leadZaehler);
        const merged    = { ...cur, anfragen: [...fremde, ...eigenNeu], leadZaehler: zaehler };
        persist(name, merged);
        return { status: 200, payload: { initialized: true, data: { ...merged, anfragen: eigenNeu } } };
      }
      // Admin/GF: voller Zugriff, id-erhaltend, nur whitelistete Felder.
      const merged = {
        ...cur,
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

/**
 * App-Einstellungen (Branding & Impressum) — serverseitig persistiert.
 *
 * Speichert Theme (Mood), Logo und Impressums-Angaben in einer JSON-Datei,
 * damit sie für ALLE Nutzer gelten und Neustarts überdauern.
 *
 *   GET /api/settings   → öffentlich (Theme/Logo werden app-weit gebraucht)
 *   PUT /api/settings   → nur Admin (in Produktion); Body = vollständige Settings
 *
 * Hinweis: Wie der Auth-Scaffold ist dies bewusst schlank. In Produktion
 * sollte der Datei-Store durch eine echte DB ersetzt werden.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'settings.json');
const IS_PROD   = process.env.NODE_ENV === 'production';

const DEFAULT_SETTINGS = {
  themeId: 'tomatenrot',
  customColor: null,
  logoDataUrl: null,
  impressum: {
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    geschaeftsfuehrung: [''],
    amtsgericht: '',
    handelsregisternummer: '',
    umsatzsteuerId: '',
  },
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(DATA_FILE, 'utf8')) };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

function persist(settings) {
  cache = settings;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] persist failed:', e?.message);
    throw Object.assign(new Error('Could not persist settings'), { status: 500 });
  }
}

// ── Validierung / Normalisierung des eingehenden Body ────────────────────────
function sanitizeImpressum(imp) {
  const src = imp && typeof imp === 'object' ? imp : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  let gf = Array.isArray(src.geschaeftsfuehrung) ? src.geschaeftsfuehrung.map(str) : [''];
  if (gf.length === 0) gf = [''];
  return {
    strasse: str(src.strasse),
    hausnummer: str(src.hausnummer),
    plz: str(src.plz),
    ort: str(src.ort),
    geschaeftsfuehrung: gf,
    amtsgericht: str(src.amtsgericht),
    handelsregisternummer: str(src.handelsregisternummer),
    umsatzsteuerId: str(src.umsatzsteuerId),
  };
}

function sanitize(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    themeId: typeof src.themeId === 'string' ? src.themeId : DEFAULT_SETTINGS.themeId,
    customColor: typeof src.customColor === 'string' ? src.customColor : null,
    logoDataUrl: typeof src.logoDataUrl === 'string' ? src.logoDataUrl : null,
    impressum: sanitizeImpressum(src.impressum),
  };
}

/**
 * Behandelt /api/settings.
 * @param ctx { user } — eingeloggter Nutzer (oder null) für die Admin-Prüfung
 * @returns { status, payload } oder null, wenn keine Settings-Route
 */
export function handleSettings(method, url, body, ctx = {}) {
  if (url !== '/api/settings') return null;

  if (method === 'GET') {
    return { status: 200, payload: load() };
  }

  if (method === 'PUT') {
    // In Produktion nur Admins; in Dev (Scaffold) offen, damit der Rollen-
    // Switcher ohne echte Anmeldung testbar bleibt.
    if (IS_PROD && ctx.user?.rolle !== 'admin') {
      return { status: 403, payload: { error: 'Nur Admins dürfen Einstellungen ändern.' } };
    }
    const next = sanitize(body);
    persist(next);
    return { status: 200, payload: next };
  }

  return { status: 405, payload: { error: 'Method not allowed' } };
}

import { useAuthStore } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface DataEnvelope<T = unknown> {
  /** true, sobald die Kollektion serverseitig angelegt wurde */
  initialized: boolean;
  data: T;
}

/** Stabile, gerätelokale ID (ein „Gerät" pro Browser-Profil). */
export function getDeviceId(): string {
  let id = localStorage.getItem('ek-device-id');
  if (!id) {
    id = (crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('ek-device-id', id);
  }
  return id;
}

/**
 * Identifiziert Nutzer + Gerät gegenüber dem Server. In Produktion ist das
 * Session-Cookie maßgeblich; der E-Mail-Header dient als Dev-Fallback (Rollen-
 * Switcher). X-Device-Id erzwingt „nur ein Gerät gleichzeitig".
 */
export function identityHeaders(): Record<string, string> {
  const email = useAuthStore.getState().user?.email;
  return { 'X-Device-Id': getDeviceId(), ...(email ? { 'X-User-Email': email } : {}) };
}

let onDeactivated: (() => void) | null = null;
let onSuperseded: (() => void) | null = null;
/** Wird gesetzt, sobald der Server das Konto als deaktiviert meldet. */
export function setOnDeactivated(cb: () => void) { onDeactivated = cb; }
/** Wird gesetzt, sobald die Sitzung auf einem anderen Gerät übernommen wurde. */
export function setOnSuperseded(cb: () => void) { onSuperseded = cb; }

/** Erkennt serverseitigen Logout-Grund (Deaktivierung / Gerätewechsel). */
async function checkAuthError(res: Response): Promise<boolean> {
  if (res.status !== 401 && res.status !== 403) return false;
  const body = await res.clone().json().catch(() => null);
  if (body?.error === 'ACCOUNT_DEACTIVATED') { onDeactivated?.(); return true; }
  if (body?.error === 'SESSION_SUPERSEDED')  { onSuperseded?.();  return true; }
  return false;
}

/** Beansprucht dieses Gerät als aktive Sitzung (verdrängt andere Geräte). */
export async function claimSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/session/claim`, {
      method: 'POST', credentials: 'include', headers: { ...identityHeaders() },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Holt serverseitig eine atomar vergebene, eindeutige Nummer (Bestell-/Lead-Nr.).
 * Verhindert Doppelnummern bei gleichzeitiger Erstellung auf mehreren Geräten.
 * Gibt null zurück, wenn der Server nicht erreichbar ist → Aufrufer fällt dann
 * auf die lokale Vergabe zurück (offline-Notbetrieb).
 */
export async function naechsteNummer(typ: 'bestellung' | 'lead', jahr: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/nummer`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...identityHeaders() },
      body: JSON.stringify({ typ, jahr }),
    });
    if (!res.ok) { await checkAuthError(res); return null; }
    const j = await res.json();
    return typeof j?.nummer === 'string' ? j.nummer : null;
  } catch {
    return null;
  }
}

/** Lädt eine Kollektion vom Server. null bei Netzwerkfehler (Server offline). */
export async function fetchData<T = unknown>(name: string): Promise<DataEnvelope<T> | null> {
  try {
    const res = await fetch(`${BASE}/api/data/${name}`, {
      credentials: 'include',
      headers: { ...identityHeaders() },
    });
    if (!res.ok) { await checkAuthError(res); return null; }
    return await res.json();
  } catch {
    return null;
  }
}

/** Speichert die vollständige Kollektion serverseitig. */
export async function saveData(name: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/data/${name}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...identityHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) { await checkAuthError(res); return false; }
    return true;
  } catch {
    return false;
  }
}

/** Fragt den Konto-Status ab (aktiv?). null bei Netzwerkfehler/Auth-Fehler. */
export async function fetchMe(): Promise<{ authenticated: boolean; active: boolean } | null> {
  try {
    const res = await fetch(`${BASE}/api/me`, { credentials: 'include', headers: { ...identityHeaders() } });
    if (!res.ok) { await checkAuthError(res); return null; }
    return await res.json();
  } catch {
    return null;
  }
}

import { useAuthStore } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface DataEnvelope<T = unknown> {
  /** true, sobald die Kollektion serverseitig angelegt wurde */
  initialized: boolean;
  data: T;
}

/**
 * Identifiziert den aktuellen Nutzer gegenüber dem Server. In Produktion ist
 * das Session-Cookie maßgeblich; der Header dient als Dev-Fallback (kein echter
 * Session-Login über den Rollen-Switcher).
 */
function identityHeaders(): Record<string, string> {
  const email = useAuthStore.getState().user?.email;
  return email ? { 'X-User-Email': email } : {};
}

/** Wird gesetzt, sobald der Server das Konto als deaktiviert meldet. */
let onDeactivated: (() => void) | null = null;
export function setOnDeactivated(cb: () => void) { onDeactivated = cb; }

/** Erkennt die serverseitige Deaktivierung (403 ACCOUNT_DEACTIVATED) → Logout. */
async function checkDeactivated(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const body = await res.clone().json().catch(() => null);
  if (body?.error === 'ACCOUNT_DEACTIVATED') { onDeactivated?.(); return true; }
  return false;
}

/** Lädt eine Kollektion vom Server. null bei Netzwerkfehler (Server offline). */
export async function fetchData<T = unknown>(name: string): Promise<DataEnvelope<T> | null> {
  try {
    const res = await fetch(`${BASE}/api/data/${name}`, {
      credentials: 'include',
      headers: { ...identityHeaders() },
    });
    if (!res.ok) { await checkDeactivated(res); return null; }
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
    if (!res.ok) { await checkDeactivated(res); return false; }
    return true;
  } catch {
    return false;
  }
}

/** Fragt den Konto-Status ab (aktiv?). null bei Netzwerkfehler. */
export async function fetchMe(): Promise<{ authenticated: boolean; active: boolean } | null> {
  try {
    const res = await fetch(`${BASE}/api/me`, { credentials: 'include', headers: { ...identityHeaders() } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

import type { Impressum } from '../store/settingsStore';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface SettingsData {
  themeId: string;
  customColor: string | null;
  logoDataUrl: string | null;
  impressum: Impressum;
  rabattLimitProzent?: number;
}

/** Lädt die app-weiten Einstellungen vom Server (öffentlich). */
export async function fetchSettings(): Promise<SettingsData | null> {
  try {
    const res = await fetch(`${BASE}/api/settings`, { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // Server offline → lokaler Cache bleibt aktiv
  }
}

/** Speichert die vollständigen Einstellungen serverseitig (nur Admin in Prod). */
export async function saveSettings(data: SettingsData): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface DataEnvelope<T = unknown> {
  /** true, sobald die Kollektion serverseitig angelegt wurde */
  initialized: boolean;
  data: T;
}

/** Lädt eine Kollektion vom Server. null bei Netzwerkfehler (Server offline). */
export async function fetchData<T = unknown>(name: string): Promise<DataEnvelope<T> | null> {
  try {
    const res = await fetch(`${BASE}/api/data/${name}`, { credentials: 'include' });
    if (!res.ok) return null;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * OCR-Dienst: liest fotografierte Bewirtungsbelege via Claude Vision aus.
 *
 * Die eigentlichen Claude-Aufrufe laufen über den Backend-Proxy
 * (server/index.mjs) — der Anthropic-API-Key bleibt serverseitig und wird
 * niemals an den Browser ausgeliefert. Der Browser sendet nur die Bilddaten.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface ExtractedPosition {
  kategorie: string;
  bezeichnung: string;
  einheit: string;
  preis: number;
  menge: number;
}

export interface ExtractedBeleg {
  besteller?: string;
  cateringDatumVon?: string;   // YYYY-MM-DD
  cateringDatumBis?: string;
  uhrzeitVon?: string;         // HH:MM
  uhrzeitBis?: string;
  veranstaltung?: string;
  ort?: string;
  raum?: string;
  personenzahl?: number;
  konto?: string;
  kostenstelle?: string;
  kostentraeger?: string;
  wuensche?: string;
  rechnungsanschriftFirma?: string;
  rechnungsanschriftZuHaenden?: string;
  rechnungsanschriftStrasse?: string;
  rechnungsanschriftPlzOrt?: string;
  rechnungsanschriftAnlass?: string;
  rechnungsanschriftTeilnehmer?: string;
  rechnungsanschriftTelefon?: string;
  positionen?: ExtractedPosition[];
}

export interface ExtractedAbschlussPosition {
  bezeichnung: string;
  ausgeliefert?: number;
  zurueckVoll?: number;
  zurueckLeer?: number;
  berechnen?: number;
  pfand?: number;
}

/** Wirft einen Error, dessen message bei fehlender Server-Konfiguration 'AI_NOT_CONFIGURED' ist. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Server nicht erreichbar');
  }
  if (res.status === 503) throw new Error('AI_NOT_CONFIGURED');
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Server-Fehler ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function extractFromPhoto(dataUrl: string): Promise<ExtractedBeleg> {
  const { data } = await postJson<{ data: ExtractedBeleg }>('/api/ai/ocr-beleg', { dataUrl });
  return data;
}

export async function extractAbschluss(
  dataUrl: string,
  positionen: { bezeichnung: string }[],
): Promise<ExtractedAbschlussPosition[]> {
  const { data } = await postJson<{ data: ExtractedAbschlussPosition[] }>('/api/ai/ocr-abschluss', {
    dataUrl,
    positionen: positionen.map(p => ({ bezeichnung: p.bezeichnung })),
  });
  return data;
}

/**
 * OCR-Dienst: Liest einen fotografierten Bewirtungsbeleg mit Google Gemini 2.0 Flash aus
 * und gibt die extrahierten Felder zurück.
 *
 * API-Key wird in localStorage gespeichert (einmalig eingeben).
 * Alternativ: VITE_GEMINI_API_KEY in .env setzen.
 * Kostenloser Tier: 1500 Requests/Tag auf aistudio.google.com
 */

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
}

const PROMPT = `Du bist ein präziser OCR-Assistent für Bewirtungsbelege der HWK Hannover / EssKlasse Catering & Gastronomie.

Extrahiere alle erkennbaren Felder aus dem Bild des Bewirtungsbelegs und antworte NUR mit einem JSON-Objekt.
Felder die nicht erkennbar sind, weglassen.
Datumsformat: YYYY-MM-DD
Zeitformat: HH:MM (24h)
Zahlen ohne Einheiten.

JSON-Schema:
{
  "besteller": "Name des Bestellers/Auftraggebers",
  "cateringDatumVon": "YYYY-MM-DD",
  "cateringDatumBis": "YYYY-MM-DD",
  "uhrzeitVon": "HH:MM",
  "uhrzeitBis": "HH:MM",
  "veranstaltung": "Anlass/Veranstaltung",
  "ort": "Ort",
  "raum": "Raum/Bereich",
  "personenzahl": 0,
  "konto": "Kontonummer",
  "kostenstelle": "Kostenstelle",
  "kostentraeger": "Kostenträger",
  "wuensche": "Sonstige Wünsche/Bemerkungen"
}

Antworte nur mit dem JSON-Objekt, ohne Erklärungen oder Markdown.`;

export function getApiKey(): string {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem('ek_gemini_key') ||
    ''
  );
}

export function setApiKey(key: string) {
  localStorage.setItem('ek_gemini_key', key.trim());
}

export async function extractFromPhoto(dataUrl: string): Promise<ExtractedBeleg> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const isPdf = dataUrl.startsWith('data:application/pdf');
  const mimeType = isPdf ? 'application/pdf' : dataUrl.split(';')[0].split(':')[1];
  const base64 = dataUrl.split(',')[1];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 1024,
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API-Fehler ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein JSON in der Antwort gefunden.');

  return JSON.parse(jsonMatch[0]) as ExtractedBeleg;
}

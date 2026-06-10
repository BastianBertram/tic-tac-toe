/**
 * OCR-Dienst: Liest einen fotografierten Bewirtungsbeleg mit Claude Vision aus
 * und gibt die extrahierten Felder zurück.
 *
 * API-Key wird in localStorage gespeichert (einmalig eingeben).
 * Alternativ: VITE_ANTHROPIC_API_KEY in .env setzen.
 */

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
  positionen?: ExtractedPosition[];
}

const SYSTEM_PROMPT = `Du bist ein präziser OCR-Assistent für Bewirtungsbelege der HWK Hannover / EssKlasse Catering & Gastronomie.

Extrahiere alle erkennbaren Felder aus dem Bild des Bewirtungsbelegs und antworte NUR mit einem JSON-Objekt.
Felder die nicht erkennbar sind, weglassen.
Datumsformat: YYYY-MM-DD
Zeitformat: HH:MM (24h)
Zahlen ohne Einheiten.

Für Positionen/Leistungen: Extrahiere ALLE erkennbaren Positionen, auch handschriftliche.
Weise jeder Position eine passende Kategorie zu aus: Heißgetränke, Kaltgetränke, Speisen/Snacks, Sonderbestellungen, Abräumservice, Buffetaufbau, Equipment, Sonstiges.
Einheiten: Stk, Person, Std, Pauschale, kg, l, Packung

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
  "wuensche": "Sonstige Wünsche/Bemerkungen",
  "positionen": [
    { "kategorie": "Speisen/Snacks", "bezeichnung": "Belegte Brötchen", "einheit": "Stk", "preis": 2.50, "menge": 10 }
  ]
}`;

export function getApiKey(): string {
  return (
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY ||
    localStorage.getItem('ek_anthropic_key') ||
    ''
  );
}

export function setApiKey(key: string) {
  localStorage.setItem('ek_anthropic_key', key.trim());
}

export async function extractFromPhoto(dataUrl: string): Promise<ExtractedBeleg> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const isPdf = dataUrl.startsWith('data:application/pdf');
  const base64 = dataUrl.split(',')[1];
  const mediaType = dataUrl.split(';')[0].split(':')[1];

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: 'Extrahiere alle Felder aus diesem Bewirtungsbeleg. Antworte nur mit dem JSON-Objekt, ohne Erklärungen.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API-Fehler ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '{}';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein JSON in der Antwort gefunden.');

  return JSON.parse(jsonMatch[0]) as ExtractedBeleg;
}

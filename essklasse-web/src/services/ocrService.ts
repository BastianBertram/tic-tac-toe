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
  rechnungsanschriftFirma?: string;
  rechnungsanschriftZuHaenden?: string;
  rechnungsanschriftStrasse?: string;
  rechnungsanschriftPlzOrt?: string;
  rechnungsanschriftAnlass?: string;
  rechnungsanschriftTeilnehmer?: string;
  rechnungsanschriftTelefon?: string;
  positionen?: ExtractedPosition[];
}

const SYSTEM_PROMPT = `Du bist ein präziser OCR-Assistent für Bewirtungsbelege der HWK Hannover / EssKlasse Catering & Gastronomie.

Das Dokument ist ein vorgedrucktes Bestellformular. Es enthält eine Tabelle mit vielen vorgedruckten Produktzeilen.
Jede Zeile hat Spalten für: Produktgruppe, Produkt, Einheit, Preis, Menge/Anzahl, Bestellt, Zurück.

WICHTIG: Extrahiere NUR Zeilen, bei denen eine Menge oder Anzahl handschriftlich oder gedruckt eingetragen wurde (Wert > 0).
Leere Zeilen ohne Mengeneintrag ignorieren.
Lies ALLE Seiten des Dokuments sorgfältig durch.

Weise jeder Position eine passende Kategorie zu aus: Heißgetränke, Kaltgetränke, Speisen/Snacks, Sonderbestellungen, Abräumservice, Buffetaufbau, Equipment, Sonstiges.

Felder die nicht erkennbar sind, weglassen.
Datumsformat: YYYY-MM-DD
Zeitformat: HH:MM (24h)

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
  "rechnungsanschriftFirma": "Firma der Rechnungsanschrift",
  "rechnungsanschriftZuHaenden": "Zu Händen (Ansprechpartner)",
  "rechnungsanschriftStrasse": "Straße und Hausnummer",
  "rechnungsanschriftPlzOrt": "PLZ und Ort",
  "rechnungsanschriftAnlass": "Anlass der Bewirtung (Rechnungsfeld)",
  "rechnungsanschriftTeilnehmer": 0,
  "rechnungsanschriftTelefon": "Telefon für Rückfragen",
  "positionen": [
    { "kategorie": "Speisen/Snacks", "bezeichnung": "Belegte Brötchen KAT 1", "einheit": "1/2", "preis": 2.59, "menge": 20 }
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
      model: 'claude-sonnet-4-6',
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

export interface ExtractedAbschlussPosition {
  bezeichnung: string;
  ausgeliefert?: number;
  zurueckVoll?: number;
  zurueckLeer?: number;
  pfand?: number;
}

export async function extractAbschluss(
  dataUrl: string,
  positionen: { bezeichnung: string }[],
): Promise<ExtractedAbschlussPosition[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const isPdf = dataUrl.startsWith('data:application/pdf');
  const base64 = dataUrl.split(',')[1];
  const mediaType = dataUrl.split(';')[0].split(':')[1];
  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const posListe = positionen.map(p => `- "${p.bezeichnung}"`).join('\n');

  const prompt = `Du bist ein OCR-Assistent für Bewirtungsbelege der EssKlasse / HWK Hannover.

Analysiere diesen abgeschlossenen Bewirtungsbeleg und extrahiere für jede Position die tatsächlichen Mengen.

Die folgenden Positionen wurden bestellt:
${posListe}

Suche im Dokument nach den Spalten: Ausgeliefert, Zurück Voll, Zurück Leer, Pfand.
Ordne die gefundenen Werte den Positionen zu (Fuzzy-Matching auf Bezeichnung).
Felder die nicht erkennbar sind, weglassen.

Antworte NUR mit einem JSON-Array:
[
  { "bezeichnung": "exakt wie oben", "ausgeliefert": 2, "zurueckVoll": 0, "zurueckLeer": 1, "pfand": 0 }
]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API-Fehler ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]) as ExtractedAbschlussPosition[];
}

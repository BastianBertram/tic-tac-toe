import type { Bewirtungsbeleg } from '../types';

function getApiKey(): string {
  return localStorage.getItem('ek_api_key') ?? (import.meta.env.VITE_ANTHROPIC_API_KEY as string) ?? '';
}

export async function checkDuplikate(
  beleg: Bewirtungsbeleg,
  candidates: Bewirtungsbeleg[],
): Promise<Bewirtungsbeleg[]> {
  if (candidates.length === 0) return [];

  const apiKey = getApiKey();
  if (!apiKey) return [];

  const kandidatenText = candidates
    .map(c =>
      `ID:${c.id} | Nr:${c.bestellungsnummer} | Rechnung:${c.rechnungsnummer ?? '-'} | Datum:${c.cateringDatumVon} | Veranstaltung:${c.veranstaltung ?? '-'} | Besteller:${c.besteller ?? '-'} | Ort:${c.ort ?? '-'} | Raum:${c.raum ?? '-'} | Kostenstelle:${c.kostenstelle ?? '-'} | Personen:${c.personenzahl}`
    )
    .join('\n');

  const prompt = `Du prüfst ob ein Bewirtungsbeleg wahrscheinlich ein Duplikat einer bereits abgerechneten Bewirtung ist.

AKTUELLER BELEG (noch keine Rechnung):
Datum: ${beleg.cateringDatumVon}
Veranstaltung: ${beleg.veranstaltung ?? '-'}
Besteller: ${beleg.besteller ?? '-'}
Ort: ${beleg.ort ?? '-'}
Raum: ${beleg.raum ?? '-'}
Kostenstelle: ${beleg.kostenstelle ?? '-'}
Personen: ${beleg.personenzahl}

BEREITS ABGERECHNETE BELEGE:
${kandidatenText}

Antworte NUR mit einem JSON-Array der IDs von wahrscheinlichen Duplikaten (leeres Array wenn keine):
["id1", "id2"]

Kriterien: gleiches Datum + ähnliche Veranstaltung + gleicher Besteller oder Raum. Sei konservativ — nur bei hoher Wahrscheinlichkeit zurückgeben.`;

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
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const ids: string[] = JSON.parse(match[0]);
  return candidates.filter(c => ids.includes(c.id));
}

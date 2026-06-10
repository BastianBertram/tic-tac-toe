import type { Bewirtungsbeleg } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Rule-based pre-check: same date + besteller, or same date + kostenstelle + raum */
function ruleBasedDuplikate(beleg: Bewirtungsbeleg, candidates: Bewirtungsbeleg[]): Bewirtungsbeleg[] {
  return candidates.filter(c => {
    const sameDate = c.cateringDatumVon === beleg.cateringDatumVon;
    if (!sameDate) return false;
    const sameBesteller = beleg.besteller && c.besteller && c.besteller.toLowerCase() === beleg.besteller.toLowerCase();
    const sameKostenstelle = beleg.kostenstelle && c.kostenstelle && c.kostenstelle === beleg.kostenstelle;
    const sameRaum = beleg.raum && c.raum && c.raum.toLowerCase() === beleg.raum.toLowerCase();
    return sameBesteller || (sameKostenstelle && sameRaum);
  });
}

export async function checkDuplikate(
  beleg: Bewirtungsbeleg,
  candidates: Bewirtungsbeleg[],
): Promise<Bewirtungsbeleg[]> {
  // Rule-based: schnell und zuverlässig für offensichtliche Fälle
  const ruleHits = ruleBasedDuplikate(beleg, candidates);
  if (ruleHits.length > 0) return ruleHits;

  if (candidates.length === 0) return [];

  // AI-Fallback über den Backend-Proxy (Anthropic-Key bleibt serverseitig).
  try {
    const res = await fetch(`${BASE}/api/ai/duplikat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beleg, candidates }),
    });
    if (!res.ok) return [];
    const { ids } = await res.json() as { ids?: string[] };
    if (!Array.isArray(ids)) return [];
    return candidates.filter(c => ids.includes(c.id));
  } catch {
    return [];
  }
}

import type { SalesAnfrage, SalesStatus } from '../../types';
import { useSalesStore } from '../../store/salesStore';
import { useObjektFilter } from '../../store/objektStore';

export const OFFENE_STATUS: SalesStatus[] = ['neu', 'qualifiziert', 'angebot', 'verhandlung'];

/**
 * Leads, die der aktuelle Nutzer sehen darf — auf die zugeordneten Objekte
 * gefiltert (Mandantentrennung). Defense-in-Depth zusätzlich zum Server-Scoping:
 * greift auch im Dev-/Offline-Betrieb, wo der lokale Store ungescopte Seed-Daten
 * enthalten kann.
 */
export function useSichtbareAnfragen(): SalesAnfrage[] {
  const anfragen = useSalesStore(st => st.anfragen);
  const { matchObjekt } = useObjektFilter();
  return anfragen.filter(a => !a.deleted && matchObjekt(a.objektId));
}

/** Kompakte Euro-Darstellung: 1.250 €, 12,5 T€, 1,8 Mio € */
export function euro(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio €`;
  if (Math.abs(v) >= 10_000)    return `${Math.round(v / 1000).toLocaleString('de-DE')} T€`;
  return `${Math.round(v).toLocaleString('de-DE')} €`;
}

export function euroFull(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} €`;
}

export function isOffen(a: SalesAnfrage): boolean {
  return OFFENE_STATUS.includes(a.status);
}

export function statusColor(st: SalesStatus): string {
  switch (st) {
    case 'neu':          return '#5b8def';
    case 'qualifiziert': return '#7e57c2';
    case 'angebot':      return '#e8a020';
    case 'verhandlung':  return '#e8742a';
    case 'gewonnen':     return '#2d8a4e';
    case 'verloren':     return '#c0392b';
  }
}

export function segmentLabel(seg: SalesAnfrage['segment']): string {
  return seg === 'betriebsgastronomie' ? 'Betriebsgastronomie' : 'Catering';
}

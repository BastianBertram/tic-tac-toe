import type { Angebot, AngebotStatus, Produkt } from '../../types';
import { useAngeboteStore } from '../../store/angeboteStore';
import { useProduktStore } from '../../store/produktStore';
import { useObjektFilter } from '../../store/objektStore';

/**
 * Angebote, die der aktuelle Nutzer sehen darf — auf die zugeordneten Objekte
 * gefiltert (Mandantentrennung), Tombstones ausgeblendet. Defense-in-Depth
 * zusätzlich zum Server-Scoping (greift auch im Dev-/Offline-Betrieb).
 */
export function useSichtbareAngebote(): Angebot[] {
  const angebote = useAngeboteStore(st => st.angebote);
  const { matchObjekt } = useObjektFilter();
  return angebote.filter(a => !a.deleted && matchObjekt(a.objektId));
}

/** Aktive, nicht gelöschte Katalogprodukte (für die Positionsauswahl). */
export function useAktiveProdukte(): Produkt[] {
  const produkte = useProduktStore(st => st.produkte);
  return produkte.filter(p => !p.deleted && p.aktiv);
}

/** Ist ein versendetes Angebot über sein Gültigkeitsdatum hinaus? */
export function istAbgelaufen(a: Pick<Angebot, 'status' | 'gueltigBis'>): boolean {
  return a.status === 'versendet' && !!a.gueltigBis && a.gueltigBis < new Date().toISOString().slice(0, 10);
}

/**
 * Anzeige-Status: leitet „abgelaufen" aus gueltigBis ab, ohne den gespeicherten
 * Status zu ändern (kein Sync-Schreibzugriff). Für Listen/Detail/KPIs.
 */
export function effektiverStatus(a: Pick<Angebot, 'status' | 'gueltigBis'>): AngebotStatus {
  return istAbgelaufen(a) ? 'abgelaufen' : a.status;
}

export function angebotStatusColor(st: AngebotStatus): string {
  switch (st) {
    case 'entwurf':     return '#5b8def';
    case 'genehmigung': return '#e8a020';
    case 'versendet':   return '#7e57c2';
    case 'angenommen':  return '#2d8a4e';
    case 'abgelehnt':   return '#c0392b';
    case 'abgelaufen':  return '#7a7a7a';
  }
}

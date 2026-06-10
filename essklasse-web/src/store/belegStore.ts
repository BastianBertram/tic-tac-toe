import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Bewirtungsbeleg, AbschlussPosition } from '../types';
import { format } from 'date-fns';

interface BelegStore {
  belege: Bewirtungsbeleg[];
  /** Laufender Zähler für Bestellungsnummern, pro Kalenderjahr */
  bestellungZaehler: Record<string, number>;  // key = "26", "27", …
  addBeleg: (b: Omit<Bewirtungsbeleg, 'id' | 'erstelltAm' | 'abgeschlossen' | 'bestellungsnummer'>, erstelltVon?: string) => string;
  updateBeleg: (id: string, partial: Partial<Bewirtungsbeleg>) => void;
  deleteBeleg: (id: string) => void;
  markDoppelt: (id: string) => void;
  schliesseBeleg: (id: string, positionen: AbschlussPosition[], user?: string, abschlussfotos?: string[]) => void;
  markRechnungErstellt: (id: string, userName?: string, rechnungsnummer?: string) => void;
  getBelegeByDate: (date: string) => Bewirtungsbeleg[];
  getTodaysBelege: () => Bewirtungsbeleg[];
  getDatesWithBelege: () => string[];
  getOffeneBelege: () => Bewirtungsbeleg[];  // abgelaufen, aber noch nicht abgeschlossen
}

export const useBelegStore = create<BelegStore>()(
  persist(
    (set, get) => ({
      belege: [],
      bestellungZaehler: {},

      addBeleg: (b, erstelltVon) => {
        const id = uuidv4();
        const year = (b.cateringDatumVon ?? new Date().toISOString().slice(0, 10)).slice(2, 4); // "26" aus "2026-06-09"
        const zaehler = get().bestellungZaehler;
        const naechste = (zaehler[year] ?? 0) + 1;
        const bestellungsnummer = `A${year}${String(naechste).padStart(7, '0')}`;
        set(s => ({
          bestellungZaehler: { ...s.bestellungZaehler, [year]: naechste },
          belege: [{
            ...b, id, bestellungsnummer,
            erstelltAm: new Date().toISOString(),
            ...(erstelltVon ? { erstelltVon } : {}),
            abgeschlossen: false,
          }, ...s.belege],
        }));
        return id;
      },

      updateBeleg: (id, partial) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, ...partial } : b) })),

      deleteBeleg: (id) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, deleted: true } : b) })),

      markDoppelt: (id) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, isDoppelt: true } : b) })),

      schliesseBeleg: (id, positionen, user, abschlussfotos) =>
        set(s => ({
          belege: s.belege.map(b => b.id === id ? {
            ...b,
            abgeschlossen: true,
            abgeschlossenAm: new Date().toISOString(),
            abgeschlossenVon: user,
            abschlussPositionen: positionen,
            ...(abschlussfotos?.length ? { abschlussfotos } : {}),
          } : b),
        })),

      markRechnungErstellt: (id, userName, rechnungsnummer) =>
        set(s => ({
          belege: s.belege.map(b => b.id === id ? {
            ...b,
            rechnungErstellt: !b.rechnungErstellt,
            rechnungErstelltAm: !b.rechnungErstellt ? new Date().toISOString() : undefined,
            rechnungErstelltVon: !b.rechnungErstellt ? userName : undefined,
            rechnungsnummer: !b.rechnungErstellt ? (rechnungsnummer ?? b.rechnungsnummer) : b.rechnungsnummer,
          } : b),
        })),

      getBelegeByDate: (date) => get().belege.filter(b => !b.deleted && b.cateringDatumVon === date),

      getTodaysBelege: () => get().getBelegeByDate(format(new Date(), 'yyyy-MM-dd')),

      getDatesWithBelege: () => [...new Set(get().belege.filter(b => !b.deleted).map(b => b.cateringDatumVon))],

      getOffeneBelege: () => {
        const now = format(new Date(), 'HH:mm');
        const today = format(new Date(), 'yyyy-MM-dd');
        return get().belege.filter(b => {
          if (b.deleted || b.abgeschlossen) return false;
          if (b.cateringDatumVon < today) return true;
          if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
          return false;
        });
      },
    }),
    { name: 'essklasse-belege' }
  )
);

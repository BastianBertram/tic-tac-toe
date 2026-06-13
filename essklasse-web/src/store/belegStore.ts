import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Bewirtungsbeleg, AbschlussPosition } from '../types';
import { format } from 'date-fns';

interface BelegStore {
  belege: Bewirtungsbeleg[];
  /** Laufender Zähler für Bestellungsnummern, pro Kalenderjahr */
  bestellungZaehler: Record<string, number>;  // key = "26", "27", …
  addBeleg: (b: Omit<Bewirtungsbeleg, 'id' | 'erstelltAm' | 'abgeschlossen' | 'bestellungsnummer'>, erstelltVon?: string, vorgabeNummer?: string) => string;
  updateBeleg: (id: string, partial: Partial<Bewirtungsbeleg>) => void;
  deleteBeleg: (id: string) => void;
  markDoppelt: (id: string) => void;
  schliesseBeleg: (id: string, positionen: AbschlussPosition[], user?: string, abschlussfotos?: string[]) => void;
  markRechnungErstellt: (id: string, userName?: string, rechnungsnummer?: string) => void;
  getOffeneBelege: () => Bewirtungsbeleg[];  // abgelaufen, aber noch nicht abgeschlossen
}

export const useBelegStore = create<BelegStore>()(
  persist(
    (set, get) => ({
      belege: [],
      bestellungZaehler: {},

      addBeleg: (b, erstelltVon, vorgabeNummer) => {
        const id = uuidv4();
        const year = (b.cateringDatumVon ?? new Date().toISOString().slice(0, 10)).slice(2, 4); // "26" aus "2026-06-09"
        // Bevorzugt die serverseitig atomar vergebene Nummer (eindeutig über alle
        // Geräte). Nur falls der Server nicht erreichbar war (vorgabeNummer leer),
        // wird lokal vergeben (Offline-Notbetrieb) — dann ist der lokale Zähler maßgeblich.
        const lokalNaechste = (get().bestellungZaehler[year] ?? 0) + 1;
        const bestellungsnummer = vorgabeNummer ?? `A${year}${String(lokalNaechste).padStart(7, '0')}`;
        set(s => ({
          // Lokalen Zähler nur bei lokaler Vergabe fortschreiben; bei Servernummer
          // bleibt der Server maßgeblich (wird beim Sync hydriert).
          bestellungZaehler: vorgabeNummer ? s.bestellungZaehler : { ...s.bestellungZaehler, [year]: lokalNaechste },
          belege: [{
            ...b, id, bestellungsnummer,
            belegVersion: 1,
            erstelltAm: new Date().toISOString(),
            aktualisiertAm: new Date().toISOString(),
            ...(erstelltVon ? { erstelltVon } : {}),
            abgeschlossen: false,
          }, ...s.belege],
        }));
        return id;
      },

      updateBeleg: (id, partial) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, ...partial, aktualisiertAm: new Date().toISOString() } : b) })),

      deleteBeleg: (id) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, deleted: true, aktualisiertAm: new Date().toISOString() } : b) })),

      markDoppelt: (id) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, isDoppelt: true, aktualisiertAm: new Date().toISOString() } : b) })),

      schliesseBeleg: (id, positionen, user, abschlussfotos) =>
        set(s => ({
          belege: s.belege.map(b => b.id === id ? {
            ...b,
            abgeschlossen: true,
            abgeschlossenAm: new Date().toISOString(),
            aktualisiertAm: new Date().toISOString(),
            abgeschlossenVon: user,
            abschlussPositionen: positionen,
            ...(abschlussfotos?.length ? { abschlussfotos } : {}),
          } : b),
        })),

      markRechnungErstellt: (id, userName, rechnungsnummer) =>
        set(s => ({
          belege: s.belege.map(b => b.id === id ? {
            ...b,
            rechnungErstellt: true,
            rechnungErstelltAm: new Date().toISOString(),
            aktualisiertAm: new Date().toISOString(),
            rechnungErstelltVon: userName,
            rechnungsnummer: rechnungsnummer ?? b.rechnungsnummer,
          } : b),
        })),

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

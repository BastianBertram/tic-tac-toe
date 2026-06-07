import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Bewirtungsbeleg, SyncStatus, AbschlussPosition } from '../types';
import { format } from 'date-fns';

interface BelegStore {
  belege: Bewirtungsbeleg[];
  addBeleg: (b: Omit<Bewirtungsbeleg, 'id' | 'erstelltAm' | 'syncStatus' | 'abgeschlossen'>) => string;
  updateBeleg: (id: string, partial: Partial<Bewirtungsbeleg>) => void;
  deleteBeleg: (id: string) => void;
  setSyncStatus: (id: string, status: SyncStatus, fehler?: string) => void;
  setBcAuftragsnummer: (id: string, nr: string) => void;
  schliesseBeleg: (id: string, positionen: AbschlussPosition[], user?: string) => void;
  getBelegeByDate: (date: string) => Bewirtungsbeleg[];
  getTodaysBelege: () => Bewirtungsbeleg[];
  getDatesWithBelege: () => string[];
  getPendingBelege: () => Bewirtungsbeleg[];
  getOffeneBelege: () => Bewirtungsbeleg[];  // abgelaufen, aber noch nicht abgeschlossen
}

export const useBelegStore = create<BelegStore>()(
  persist(
    (set, get) => ({
      belege: [],

      addBeleg: (b) => {
        const id = uuidv4();
        set(s => ({
          belege: [{
            ...b, id,
            erstelltAm: new Date().toISOString(),
            syncStatus: 'local',
            abgeschlossen: false,
          }, ...s.belege],
        }));
        return id;
      },

      updateBeleg: (id, partial) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, ...partial } : b) })),

      deleteBeleg: (id) =>
        set(s => ({ belege: s.belege.filter(b => b.id !== id) })),

      setSyncStatus: (id, status, fehler) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, syncStatus: status, bcFehler: fehler } : b) })),

      setBcAuftragsnummer: (id, nr) =>
        set(s => ({ belege: s.belege.map(b => b.id === id ? { ...b, bcAuftragsnummer: nr, syncStatus: 'synced' } : b) })),

      schliesseBeleg: (id, positionen, user) =>
        set(s => ({
          belege: s.belege.map(b => b.id === id ? {
            ...b,
            abgeschlossen: true,
            abgeschlossenAm: new Date().toISOString(),
            abgeschlossenVon: user,
            abschlussPositionen: positionen,
          } : b),
        })),

      getBelegeByDate: (date) => get().belege.filter(b => b.cateringDatumVon === date),

      getTodaysBelege: () => get().getBelegeByDate(format(new Date(), 'yyyy-MM-dd')),

      getDatesWithBelege: () => [...new Set(get().belege.map(b => b.cateringDatumVon))],

      getPendingBelege: () => get().belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error'),

      getOffeneBelege: () => {
        const now = format(new Date(), 'HH:mm');
        const today = format(new Date(), 'yyyy-MM-dd');
        return get().belege.filter(b => {
          if (b.abgeschlossen) return false;
          // Vergangener Tag
          if (b.cateringDatumVon < today) return true;
          // Heute und Uhrzeit bereits abgelaufen
          if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
          return false;
        });
      },
    }),
    { name: 'essklasse-belege' }
  )
);

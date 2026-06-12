import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Objekt } from '../types';

/** Sentinel für „Alle Objekte" (z.B. Bereichsleitung sieht alle zugeordneten). */
export const ALLE_OBJEKTE = 'ALL';

interface ObjektStore {
  /** Alle dem User zugeordneten Objekte (wird nach Login vom API geladen) */
  objekte: Objekt[];
  /** Das aktuell aktive Objekt */
  aktiveObjektId: string | null;

  setObjekte: (objekte: Objekt[]) => void;
  updateObjekt: (id: string, partial: Partial<Objekt>) => void;
  toggleAktiv: (id: string) => void;
  setAktiveObjektId: (id: string) => void;
  getAktivesObjekt: () => Objekt | null;
  reset: () => void;
}

export const useObjektStore = create<ObjektStore>()(
  persist(
    (set, get) => ({
      objekte: [],
      aktiveObjektId: null,

      setObjekte: (objekte) => {
        const current = get().aktiveObjektId;
        if (current === ALLE_OBJEKTE) { set({ objekte }); return; } // „Alle Objekte" beibehalten
        // Falls das aktive Objekt nicht mehr in der Liste ist → erstes wählen
        const stillValid = objekte.some(o => o.id === current);
        set({
          objekte,
          aktiveObjektId: stillValid ? current : (objekte[0]?.id ?? null),
        });
      },

      updateObjekt: (id, partial) =>
        set(s => ({ objekte: s.objekte.map(o => o.id === id ? { ...o, ...partial } : o) })),

      toggleAktiv: (id) =>
        set(s => ({ objekte: s.objekte.map(o => o.id === id ? { ...o, aktiv: !(o.aktiv ?? true) } : o) })),

      setAktiveObjektId: (id) => set({ aktiveObjektId: id }),

      getAktivesObjekt: () => {
        const { objekte, aktiveObjektId } = get();
        if (aktiveObjektId === ALLE_OBJEKTE) return null; // „Alle Objekte"-Ansicht
        return objekte.find(o => o.id === aktiveObjektId) ?? objekte[0] ?? null;
      },

      reset: () => set({ objekte: [], aktiveObjektId: null }),
    }),
    { name: 'ek-objekte' }
  )
);

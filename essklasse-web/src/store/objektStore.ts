import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Objekt } from '../types';

interface ObjektStore {
  /** Alle dem User zugeordneten Objekte (wird nach Login vom API geladen) */
  objekte: Objekt[];
  /** Das aktuell aktive Objekt */
  aktiveObjektId: string | null;

  setObjekte: (objekte: Objekt[]) => void;
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
        // Falls das aktive Objekt nicht mehr in der Liste ist → erstes wählen
        const stillValid = objekte.some(o => o.id === current);
        set({
          objekte,
          aktiveObjektId: stillValid ? current : (objekte[0]?.id ?? null),
        });
      },

      setAktiveObjektId: (id) => set({ aktiveObjektId: id }),

      getAktivesObjekt: () => {
        const { objekte, aktiveObjektId } = get();
        return objekte.find(o => o.id === aktiveObjektId) ?? objekte[0] ?? null;
      },

      reset: () => set({ objekte: [], aktiveObjektId: null }),
    }),
    { name: 'ek-objekte' }
  )
);

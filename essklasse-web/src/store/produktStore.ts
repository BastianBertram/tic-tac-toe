import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Produkt } from '../types';

interface ProduktStore {
  produkte: Produkt[];
  addProdukt: (p: Omit<Produkt, 'id' | 'erstelltAm' | 'aktualisiertAm'>) => string;
  updateProdukt: (id: string, partial: Partial<Produkt>) => void;
  /** Soft-Delete (Tombstone) — Server hält den Datensatz id-erhaltend. */
  deleteProdukt: (id: string) => void;
}

export const useProduktStore = create<ProduktStore>()(
  persist(
    (set) => ({
      produkte: [],

      addProdukt: (p) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        set(s => ({ produkte: [{ ...p, id, erstelltAm: now, aktualisiertAm: now }, ...s.produkte] }));
        return id;
      },

      updateProdukt: (id, partial) =>
        set(s => ({
          produkte: s.produkte.map(p =>
            p.id === id ? { ...p, ...partial, aktualisiertAm: new Date().toISOString() } : p
          ),
        })),

      deleteProdukt: (id) =>
        set(s => ({
          produkte: s.produkte.map(p =>
            p.id === id ? { ...p, deleted: true, aktualisiertAm: new Date().toISOString() } : p
          ),
        })),
    }),
    { name: 'essklasse-produkte' }
  )
);

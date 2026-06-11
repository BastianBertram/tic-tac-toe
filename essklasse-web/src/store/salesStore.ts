import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { SalesAnfrage, SalesStatus, SalesAktivitaet, SalesAktivitaetTyp } from '../types';
import { SALES_STATUS_LABEL } from '../types';

interface SalesStore {
  anfragen: SalesAnfrage[];
  /** Laufender Zähler für Lead-Nummern, pro Kalenderjahr */
  leadZaehler: Record<string, number>;

  addAnfrage: (a: Omit<SalesAnfrage, 'id' | 'nummer' | 'erstelltAm' | 'aktualisiertAm' | 'aktivitaeten' | 'status'> & { status?: SalesStatus }) => string;
  updateAnfrage: (id: string, partial: Partial<SalesAnfrage>) => void;
  deleteAnfrage: (id: string) => void;
  setStatus: (id: string, status: SalesStatus, von?: string, verlustgrund?: string) => void;
  addAktivitaet: (id: string, typ: SalesAktivitaetTyp, text: string, von?: string) => void;
}

export const useSalesStore = create<SalesStore>()(
  persist(
    (set, get) => ({
      anfragen: [],
      leadZaehler: {},

      addAnfrage: (a) => {
        const id = uuidv4();
        const year = (a.datum ?? new Date().toISOString().slice(0, 10)).slice(2, 4);
        const naechste = (get().leadZaehler[year] ?? 0) + 1;
        const nummer = `L${year}${String(naechste).padStart(4, '0')}`;
        const now = new Date().toISOString();
        set(s => ({
          leadZaehler: { ...s.leadZaehler, [year]: naechste },
          anfragen: [{
            ...a,
            id,
            nummer,
            status: a.status ?? 'neu',
            aktivitaeten: [{ id: uuidv4(), typ: 'notiz', text: 'Anfrage angelegt', datum: now, von: a.verantwortlich }],
            erstelltAm: now,
            aktualisiertAm: now,
          }, ...s.anfragen],
        }));
        return id;
      },

      updateAnfrage: (id, partial) =>
        set(s => ({
          anfragen: s.anfragen.map(a =>
            a.id === id ? { ...a, ...partial, aktualisiertAm: new Date().toISOString() } : a
          ),
        })),

      deleteAnfrage: (id) =>
        set(s => ({ anfragen: s.anfragen.filter(a => a.id !== id) })),

      setStatus: (id, status, von, verlustgrund) =>
        set(s => ({
          anfragen: s.anfragen.map(a => {
            if (a.id !== id) return a;
            const akt: SalesAktivitaet = {
              id: uuidv4(),
              typ: 'statuswechsel',
              text: `Status → ${SALES_STATUS_LABEL[status]}${verlustgrund ? ` (${verlustgrund})` : ''}`,
              datum: new Date().toISOString(),
              von,
            };
            return {
              ...a,
              status,
              verlustgrund: status === 'verloren' ? (verlustgrund ?? a.verlustgrund) : undefined,
              aktivitaeten: [akt, ...a.aktivitaeten],
              aktualisiertAm: new Date().toISOString(),
            };
          }),
        })),

      addAktivitaet: (id, typ, text, von) =>
        set(s => ({
          anfragen: s.anfragen.map(a =>
            a.id === id ? {
              ...a,
              aktivitaeten: [{ id: uuidv4(), typ, text, datum: new Date().toISOString(), von }, ...a.aktivitaeten],
              aktualisiertAm: new Date().toISOString(),
            } : a
          ),
        })),
    }),
    { name: 'essklasse-sales' }
  )
);

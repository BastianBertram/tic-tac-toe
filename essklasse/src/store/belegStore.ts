import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bewirtungsbeleg, BelegPosition, SyncStatus } from '../types';
import uuid from 'react-native-uuid';
import { format } from 'date-fns';

interface BelegStore {
  belege: Bewirtungsbeleg[];
  addBeleg: (beleg: Omit<Bewirtungsbeleg, 'id' | 'erstelltAm' | 'syncStatus'>) => string;
  updateBeleg: (id: string, partial: Partial<Bewirtungsbeleg>) => void;
  deleteBeleg: (id: string) => void;
  setBcAuftragsnummer: (id: string, nr: string) => void;
  setSyncStatus: (id: string, status: SyncStatus, fehler?: string) => void;
  getBelegeByDate: (date: string) => Bewirtungsbeleg[];
  getTodaysBelege: () => Bewirtungsbeleg[];
  getDatesWithBelege: () => string[];
  getPendingBelege: () => Bewirtungsbeleg[];
}

export const useBelegStore = create<BelegStore>()(
  persist(
    (set, get) => ({
      belege: [],

      addBeleg: (beleg) => {
        const id = uuid.v4() as string;
        const newBeleg: Bewirtungsbeleg = {
          ...beleg,
          id,
          erstelltAm: new Date().toISOString(),
          syncStatus: 'local',
        };
        set((s) => ({ belege: [newBeleg, ...s.belege] }));
        return id;
      },

      updateBeleg: (id, partial) =>
        set((s) => ({
          belege: s.belege.map((b) => (b.id === id ? { ...b, ...partial } : b)),
        })),

      deleteBeleg: (id) =>
        set((s) => ({ belege: s.belege.filter((b) => b.id !== id) })),

      setBcAuftragsnummer: (id, nr) =>
        set((s) => ({
          belege: s.belege.map((b) =>
            b.id === id ? { ...b, bcAuftragsnummer: nr, syncStatus: 'synced' } : b
          ),
        })),

      setSyncStatus: (id, status, fehler) =>
        set((s) => ({
          belege: s.belege.map((b) =>
            b.id === id ? { ...b, syncStatus: status, bcFehler: fehler } : b
          ),
        })),

      getBelegeByDate: (date) => {
        const { belege } = get();
        return belege.filter((b) => b.cateringDatumVon.startsWith(date));
      },

      getTodaysBelege: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return get().getBelegeByDate(today);
      },

      getDatesWithBelege: () => {
        const { belege } = get();
        const dates = new Set(belege.map((b) => b.cateringDatumVon.substring(0, 10)));
        return Array.from(dates);
      },

      getPendingBelege: () =>
        get().belege.filter((b) => b.syncStatus === 'local' || b.syncStatus === 'error'),
    }),
    {
      name: 'belege-store',
      storage: {
        getItem: async (key) => {
          const val = await AsyncStorage.getItem(key);
          return val ? JSON.parse(val) : null;
        },
        setItem: async (key, val) => {
          await AsyncStorage.setItem(key, JSON.stringify(val));
        },
        removeItem: async (key) => {
          await AsyncStorage.removeItem(key);
        },
      },
    }
  )
);

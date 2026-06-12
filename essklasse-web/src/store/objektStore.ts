import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Objekt } from '../types';

/** Sentinel für „Alle Objekte" (z.B. Bereichsleitung sieht alle zugeordneten). */
export const ALLE_OBJEKTE = 'ALL';

/**
 * Marker in `user.objektIds`, der „allen Objekten zugeordnet" bedeutet (vom
 * Admin vergebbar, z.B. für die Buchhaltung) → objektübergreifender Zugriff.
 */
export const ALLE_OBJEKTE_MARKER = '__alle__';

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

import { useAuthStore, type AuthUser } from './authStore';
import { useUserStore } from './userStore';
import type { AppUser } from '../types';

/**
 * Ermittelt die einem User zugeordneten Objekt-IDs. Quelle ist der im Admin
 * verwaltete Benutzer-Datensatz (userStore); ersatzweise die Login-Angaben.
 */
export function resolveObjektIds(user: AuthUser | null, users: AppUser[]): string[] {
  if (!user) return [];
  const record = users.find(u => u.id === user.id || u.email === user.email);
  return record?.objektIds ?? user.objektIds ?? [];
}

/**
 * Ist die Rolle an die zugeordneten Objekte gebunden?
 * Admin & Geschäftsführung haben vollen, objektübergreifenden Zugriff;
 * alle übrigen Rollen sind auf ihre Admin-Zuordnung beschränkt.
 */
export function istObjektGebunden(rolle?: string | null): boolean {
  return !!rolle && rolle !== 'admin' && rolle !== 'geschaeftsfuehrung';
}

/**
 * Objekte, die der aktuell angemeldete User sehen darf.
 * Objektgebundene Rollen sehen nur ihre zugeordneten Objekte (leere Zuordnung
 * = keine), Admin & Geschäftsführung sämtliche Objekte.
 */
export function useSichtbareObjekte(): Objekt[] {
  const objekte = useObjektStore(s => s.objekte);
  const user    = useAuthStore(s => s.user);
  const users   = useUserStore(s => s.users);
  if (istObjektGebunden(user?.rolle)) {
    const ids = resolveObjektIds(user, users);
    if (ids.includes(ALLE_OBJEKTE_MARKER)) return objekte;   // „Alle Objekte" zugeordnet
    return objekte.filter(o => ids.includes(o.id));
  }
  return objekte;
}

/**
 * Liefert das aktive Objekt (auf die sichtbaren beschränkt) sowie eine
 * Filter-Funktion für Belege. Im „Alle Objekte"-Modus werden alle sichtbaren
 * Objekte einbezogen.
 */
export function useObjektFilter() {
  const aktiveObjektId = useObjektStore(s => s.aktiveObjektId);
  const sichtbare      = useSichtbareObjekte();
  const aktivesObjekt  = aktiveObjektId === ALLE_OBJEKTE
    ? null
    : (sichtbare.find(o => o.id === aktiveObjektId) ?? sichtbare[0] ?? null);
  const sichtbareIds = new Set(sichtbare.map(o => o.id));
  const matchObjekt = (objektId: string) => {
    if (aktivesObjekt) return objektId === aktivesObjekt.id;       // einzelnes Objekt
    if (sichtbareIds.size === 0) return true;                      // keine Einschränkung
    return sichtbareIds.has(objektId);                             // alle zugeordneten
  };
  return { aktivesObjekt, sichtbare, matchObjekt };
}

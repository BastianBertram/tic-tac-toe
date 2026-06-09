import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRolle = 'user' | 'admin' | 'buchhaltung' | 'bereichsleitung' | 'geschaeftsfuehrung';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  rolle: UserRolle;
  /** Wird gesetzt wenn Geschäftsführung in eine andere Rolle switcht; merkt die echte Ursprungsrolle */
  baseRolle?: UserRolle;
  /** Objekt-IDs für rolle=user (undefined = alle für admin/buchhaltung) */
  objektIds?: string[];
}

interface AuthStore {
  user:        AuthUser | null;
  accessToken: string | null;
  setAuth:     (user: AuthUser, token: string) => void;
  setToken:    (token: string) => void;
  logout:      () => void;
  isAdmin:              () => boolean;
  isBuchhaltung:        () => boolean;
  isUser:               () => boolean;
  isBereichsleitung:    () => boolean;
  isGeschaeftsfuehrung: () => boolean;
  /** Nur true wenn der echte Ursprungsnutzer Geschäftsführung ist (auch bei aktivem Rollenwechsel) */
  isGeschaeftsfuehrungBase: () => boolean;
  switchRolleAs: (rolle: UserRolle, objektIds?: string[]) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      setAuth:     (user, accessToken) => set({ user, accessToken }),
      setToken:    (accessToken)       => set({ accessToken }),
      logout:      ()                  => set({ user: null, accessToken: null }),
      isAdmin:              () => get().user?.rolle === 'admin',
      isBuchhaltung:        () => get().user?.rolle === 'buchhaltung',
      isUser:               () => get().user?.rolle === 'user',
      isBereichsleitung:    () => get().user?.rolle === 'bereichsleitung',
      isGeschaeftsfuehrung: () => get().user?.rolle === 'geschaeftsfuehrung',
      isGeschaeftsfuehrungBase: () => {
        const u = get().user;
        return u?.rolle === 'geschaeftsfuehrung' || u?.baseRolle === 'geschaeftsfuehrung';
      },
      switchRolleAs: (rolle, objektIds) => set(s => ({
        user: s.user ? {
          ...s.user,
          rolle,
          objektIds: objektIds ?? s.user.objektIds,
          baseRolle: s.user.baseRolle ?? s.user.rolle, // merke Ursprung beim ersten Switch
        } : null,
      })),
    }),
    {
      name:        'ek-auth',
      partialize:  (s) => ({ user: s.user }),
    }
  )
);

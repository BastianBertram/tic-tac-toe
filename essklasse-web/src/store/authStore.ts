import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRolle = 'user' | 'admin' | 'buchhaltung';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  rolle: UserRolle;
  /** Objekt-IDs für rolle=user (undefined = alle für admin/buchhaltung) */
  objektIds?: string[];
}

interface AuthStore {
  user:        AuthUser | null;
  accessToken: string | null;
  setAuth:     (user: AuthUser, token: string) => void;
  setToken:    (token: string) => void;
  logout:      () => void;
  isAdmin:     () => boolean;
  isBuchhaltung: () => boolean;
  isUser:      () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      setAuth:     (user, accessToken) => set({ user, accessToken }),
      setToken:    (accessToken)       => set({ accessToken }),
      logout:      ()                  => set({ user: null, accessToken: null }),
      isAdmin:     ()                  => get().user?.rolle === 'admin',
      isBuchhaltung: ()                => get().user?.rolle === 'buchhaltung' || get().user?.rolle === 'admin',
      isUser:      ()                  => get().user?.rolle === 'user',
    }),
    {
      name:        'ek-auth',
      partialize:  (s) => ({ user: s.user }),
    }
  )
);

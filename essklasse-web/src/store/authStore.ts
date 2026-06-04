import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthStore {
  user:        AuthUser | null;
  accessToken: string | null;
  setAuth:     (user: AuthUser, token: string) => void;
  setToken:    (token: string) => void;
  logout:      () => void;
  isAdmin:     () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,
      setAuth:     (user, accessToken) => set({ user, accessToken }),
      setToken:    (accessToken)       => set({ accessToken }),
      logout:      ()                  => set({ user: null, accessToken: null }),
      isAdmin:     ()                  => get().user?.role === 'admin',
    }),
    {
      name:        'ek-auth',
      partialize:  (s) => ({ user: s.user }),
    }
  )
);

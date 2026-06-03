import { create } from 'zustand';

interface AuthUser {
  name: string;
  email: string;
  accessToken: string;
  expiresOn: Date;
}

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  getValidToken: () => string | null;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  logout: () => set({ user: null }),

  getValidToken: () => {
    const { user } = get();
    if (!user) return null;
    if (new Date() >= user.expiresOn) {
      set({ user: null });
      return null;
    }
    return user.accessToken;
  },
}));

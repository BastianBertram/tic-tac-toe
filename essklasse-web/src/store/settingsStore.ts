import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID, applyTheme } from '../theme';

interface SettingsStore {
  /** ID des aktiven Themes (Mood) */
  themeId: string;
  /** Aktives Logo: Data-URL (hochgeladen) oder '/logo.webp' (EssKlasse). null = kein Logo (Standard). */
  logoDataUrl: string | null;
  /** Anzeigename des Unternehmens (optional, für Login/Branding) */
  firmenname: string;

  setTheme: (id: string) => void;
  setLogo: (dataUrl: string | null) => void;
  setFirmenname: (name: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      logoDataUrl: null,
      firmenname: '',

      setTheme: (id) => { applyTheme(id); set({ themeId: id }); },
      setLogo: (logoDataUrl) => set({ logoDataUrl }),
      setFirmenname: (firmenname) => set({ firmenname }),
    }),
    {
      name: 'essklasse-settings',
      onRehydrateStorage: () => (state) => {
        // Theme nach dem Laden aus dem Storage anwenden
        if (state?.themeId) applyTheme(state.themeId);
      },
    }
  )
);

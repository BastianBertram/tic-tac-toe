import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID, CUSTOM_THEME_ID, applyTheme } from '../theme';

interface SettingsStore {
  /** ID des aktiven Themes (Mood) – Preset-ID oder 'custom' */
  themeId: string;
  /** Frei gewählter Hex-Farbcode, wenn themeId === 'custom' */
  customColor: string | null;
  /** Aktives Logo: Data-URL (hochgeladen) oder '/logo.webp' (EssKlasse). null = kein Logo (Standard). */
  logoDataUrl: string | null;

  /** Preset-Theme wählen */
  setTheme: (id: string) => void;
  /** Eigene Farbe (Hex) setzen und aktivieren */
  setCustomColor: (hex: string) => void;
  setLogo: (dataUrl: string | null) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME_ID,
      customColor: null,
      logoDataUrl: null,

      setTheme: (id) => { applyTheme(id, get().customColor); set({ themeId: id }); },
      setCustomColor: (hex) => { applyTheme(CUSTOM_THEME_ID, hex); set({ themeId: CUSTOM_THEME_ID, customColor: hex }); },
      setLogo: (logoDataUrl) => set({ logoDataUrl }),
    }),
    {
      name: 'essklasse-settings',
      onRehydrateStorage: () => (state) => {
        // Theme nach dem Laden aus dem Storage anwenden
        if (state?.themeId) applyTheme(state.themeId, state.customColor);
      },
    }
  )
);

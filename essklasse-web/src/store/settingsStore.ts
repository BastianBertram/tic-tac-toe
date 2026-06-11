import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID, CUSTOM_THEME_ID, applyTheme } from '../theme';

/** Impressums-/Pflichtangaben des Unternehmens */
export interface Impressum {
  /** Hauptsitz */
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  /** Geschäftsführung – kann mehrere Namen enthalten */
  geschaeftsfuehrung: string[];
  amtsgericht: string;
  handelsregisternummer: string;
  umsatzsteuerId: string;
}

export const EMPTY_IMPRESSUM: Impressum = {
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  geschaeftsfuehrung: [''],
  amtsgericht: '',
  handelsregisternummer: '',
  umsatzsteuerId: '',
};

interface SettingsStore {
  /** ID des aktiven Themes (Mood) – Preset-ID oder 'custom' */
  themeId: string;
  /** Frei gewählter Hex-Farbcode, wenn themeId === 'custom' */
  customColor: string | null;
  /** Aktives Logo: Data-URL (hochgeladen) oder '/logo.webp' (EssKlasse). null = kein Logo (Standard). */
  logoDataUrl: string | null;
  /** Impressums-Angaben */
  impressum: Impressum;

  /** Preset-Theme wählen */
  setTheme: (id: string) => void;
  /** Eigene Farbe (Hex) setzen und aktivieren */
  setCustomColor: (hex: string) => void;
  setLogo: (dataUrl: string | null) => void;
  /** Impressum (teilweise) aktualisieren */
  setImpressum: (partial: Partial<Impressum>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME_ID,
      customColor: null,
      logoDataUrl: null,
      impressum: EMPTY_IMPRESSUM,

      setTheme: (id) => { applyTheme(id, get().customColor); set({ themeId: id }); },
      setCustomColor: (hex) => { applyTheme(CUSTOM_THEME_ID, hex); set({ themeId: CUSTOM_THEME_ID, customColor: hex }); },
      setLogo: (logoDataUrl) => set({ logoDataUrl }),
      setImpressum: (partial) => set(s => ({ impressum: { ...s.impressum, ...partial } })),
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

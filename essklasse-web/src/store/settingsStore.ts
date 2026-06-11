import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID, CUSTOM_THEME_ID, applyTheme } from '../theme';
import { fetchSettings, saveSettings } from '../services/settingsService';

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
  /** Einstellungen vom Server laden (Server ist Quelle der Wahrheit) */
  hydrateFromServer: () => Promise<void>;
}

/** Schreibt die aktuellen Settings (debounced) zurück auf den Server. */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush(get: () => SettingsStore) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const { themeId, customColor, logoDataUrl, impressum } = get();
    void saveSettings({ themeId, customColor, logoDataUrl, impressum });
  }, 400);
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME_ID,
      customColor: null,
      logoDataUrl: null,
      impressum: EMPTY_IMPRESSUM,

      setTheme: (id) => { applyTheme(id, get().customColor); set({ themeId: id }); schedulePush(get); },
      setCustomColor: (hex) => { applyTheme(CUSTOM_THEME_ID, hex); set({ themeId: CUSTOM_THEME_ID, customColor: hex }); schedulePush(get); },
      setLogo: (logoDataUrl) => { set({ logoDataUrl }); schedulePush(get); },
      setImpressum: (partial) => { set(s => ({ impressum: { ...s.impressum, ...partial } })); schedulePush(get); },

      hydrateFromServer: async () => {
        const data = await fetchSettings();
        if (!data) return; // Server offline → lokaler Cache bleibt aktiv
        set({
          themeId: data.themeId ?? DEFAULT_THEME_ID,
          customColor: data.customColor ?? null,
          logoDataUrl: data.logoDataUrl ?? null,
          impressum: { ...EMPTY_IMPRESSUM, ...data.impressum },
        });
        applyTheme(data.themeId ?? DEFAULT_THEME_ID, data.customColor);
      },
    }),
    {
      name: 'essklasse-settings',
      // Lokaler Cache nur fürs sofortige Anwenden beim Start; Server ist führend.
      partialize: (s) => ({ themeId: s.themeId, customColor: s.customColor, logoDataUrl: s.logoDataUrl, impressum: s.impressum }),
      onRehydrateStorage: () => (state) => {
        // Gecachtes Theme sofort anwenden; Server-Abgleich erfolgt beim App-Start.
        if (state?.themeId) applyTheme(state.themeId, state.customColor);
      },
    }
  )
);

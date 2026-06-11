/**
 * App-Themes („Moods") — jede Variante überschreibt die Primär-/Akzentfarben,
 * die in index.css als CSS-Variablen definiert sind.
 */
export interface ThemeMood {
  id: string;
  name: string;
  /** Hauptfarbe (= --ek-red) */
  primary: string;
  /** heller Akzent (= --ek-red-soft) */
  soft: string;
  /** dunkle Hover-Variante (= --ek-red-dark) */
  dark: string;
}

export const THEMES: ThemeMood[] = [
  { id: 'tomatenrot', name: 'Tomatenrot', primary: '#8B1A1A', soft: '#b52525', dark: '#6a1212' },
  { id: 'meerblau',   name: 'Meerblau',   primary: '#1a5b8b', soft: '#2580b5', dark: '#124566' },
  { id: 'waldgruen',  name: 'Waldgrün',   primary: '#246b4a', soft: '#2f8a5f', dark: '#184e36' },
  { id: 'aubergine',  name: 'Aubergine',  primary: '#5b2c83', soft: '#7e3fb0', dark: '#421f60' },
  { id: 'petrol',     name: 'Petrol',     primary: '#0f6e6e', soft: '#149494', dark: '#0a5050' },
  { id: 'sonnenorange', name: 'Sonnenorange', primary: '#c0610e', soft: '#e07c1c', dark: '#8f470a' },
  { id: 'anthrazit',  name: 'Anthrazit',  primary: '#37414d', soft: '#4d5a6b', dark: '#262d36' },
  { id: 'beere',      name: 'Beere',      primary: '#a01b56', soft: '#c8326f', dark: '#76123e' },
];

export const DEFAULT_THEME_ID = 'tomatenrot';

export function getTheme(id: string): ThemeMood {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

/** Setzt die Theme-Farben als CSS-Variablen auf dem <html>-Element. */
export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement.style;
  root.setProperty('--ek-red', t.primary);
  root.setProperty('--ek-red-soft', t.soft);
  root.setProperty('--ek-red-dark', t.dark);
}

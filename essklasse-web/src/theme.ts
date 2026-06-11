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
/** ID für eine frei gewählte Farbe (Hex-Eingabe) */
export const CUSTOM_THEME_ID = 'custom';

export function getTheme(id: string): ThemeMood {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

/** Prüft, ob ein String ein gültiger Hex-Farbcode ist (#RGB oder #RRGGBB). */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/** Normalisiert einen Hex-Code auf die Form #rrggbb (Kleinbuchstaben). */
export function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h.toLowerCase();
}

/** Mischt eine Hex-Farbe um `amount` (0..1) Richtung Weiß (>0) bzw. Schwarz (<0). */
function shade(hex: string, amount: number): string {
  const h = normalizeHex(hex).slice(1);
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  r = Math.round(r + (target - r) * t);
  g = Math.round(g + (target - g) * t);
  b = Math.round(b + (target - b) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Leitet aus einer Primärfarbe die hellere (soft) und dunklere (dark) Variante ab. */
export function deriveMood(primary: string): ThemeMood {
  const p = normalizeHex(primary);
  return { id: CUSTOM_THEME_ID, name: 'Eigene Farbe', primary: p, soft: shade(p, 0.22), dark: shade(p, -0.28) };
}

/** Setzt die Theme-Farben als CSS-Variablen auf dem <html>-Element. */
export function applyTheme(id: string, customColor?: string | null) {
  const mood = id === CUSTOM_THEME_ID && customColor && isValidHex(customColor)
    ? deriveMood(customColor)
    : getTheme(id);
  const root = document.documentElement.style;
  root.setProperty('--ek-red', mood.primary);
  root.setProperty('--ek-red-soft', mood.soft);
  root.setProperty('--ek-red-dark', mood.dark);
}

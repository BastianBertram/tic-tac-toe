import type { CSSProperties } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface Props {
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

/** Pfad zum mitgelieferten EssKlasse-Logo (als Option auswählbar). */
export const ESSKLASSE_LOGO = '/logo.webp';

/**
 * Zeigt das in den Einstellungen hinterlegte Logo.
 * Standard ist „kein Logo" → es wird nichts gerendert.
 */
export function BrandLogo({ className, style, alt = 'Logo' }: Props) {
  const logoDataUrl = useSettingsStore(st => st.logoDataUrl);
  if (!logoDataUrl) return null;
  return <img src={logoDataUrl} alt={alt} className={className} style={style} />;
}

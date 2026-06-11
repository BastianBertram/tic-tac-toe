import type { CSSProperties } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface Props {
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

/** Zeigt das in den Einstellungen hinterlegte Unternehmenslogo, sonst das Standard-Logo. */
export function BrandLogo({ className, style, alt = 'EssKlasse' }: Props) {
  const logoDataUrl = useSettingsStore(st => st.logoDataUrl);
  return <img src={logoDataUrl ?? '/logo.webp'} alt={alt} className={className} style={style} />;
}

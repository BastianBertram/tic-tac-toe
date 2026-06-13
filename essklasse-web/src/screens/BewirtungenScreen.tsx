import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuthStore } from '../store/authStore';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { OffeneBanner } from '../components/OffeneBanner';
import { TodayScreen } from './TodayScreen';
import { WeekScreen } from './WeekScreen';
import { CalendarScreen } from './CalendarScreen';
import type { Bewirtungsbeleg } from '../types';
import s from './BewirtungenScreen.module.css';

type Zoom = 'tag' | 'woche' | 'monat';

interface Props {
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
  onAbschliessen: (b: Bewirtungsbeleg) => void;
  onTabAbschluss: () => void;
}

const ZOOMS: { value: Zoom; label: string }[] = [
  { value: 'tag',   label: 'Tag' },
  { value: 'woche', label: 'Woche' },
  { value: 'monat', label: 'Monat' },
];

/**
 * Fasst die drei Kalenderansichten (Heute=Tag, Woche, Kalender=Monat) unter
 * einem Menüpunkt „Bewirtungen" zusammen. Der „Zeit-Zoom"-Umschalter wechselt
 * die Granularität; die eigentlichen Ansichten werden eingebettet gerendert
 * (ohne eigenen Header — der Container liefert ihn).
 */
export function BewirtungenScreen({ onOpenBeleg, onAbschliessen, onTabAbschluss }: Props) {
  const [zoom, setZoom] = useState<Zoom>('tag');
  const rolle = useAuthStore(st => st.user?.rolle);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>📋 Bewirtungen</span>
        {rolle !== 'geschaeftsfuehrung' && (
          <div className={s.headerRight}><ObjektSwitcherButton /></div>
        )}
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* ── Zeit-Zoom: Tag / Woche / Monat ── */}
      <div className={s.zoomWrap}>
        <span className={s.zoomLabel}>🔍 Zeit-Zoom</span>
        <div className={s.zoomToggle}>
          {ZOOMS.map(z => (
            <button
              key={z.value}
              type="button"
              className={`${s.zoomBtn} ${zoom === z.value ? s.zoomActive : ''}`}
              onClick={() => setZoom(z.value)}
            >
              {zoom === z.value && <span className={s.zoomIcon}>🔍</span>}{z.label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.body}>
        {zoom === 'tag'   && <TodayScreen    embedded onOpenBeleg={onOpenBeleg} onAbschliessen={onAbschliessen} onTabAbschluss={onTabAbschluss} />}
        {zoom === 'woche' && <WeekScreen     embedded onOpenBeleg={onOpenBeleg} onTabAbschluss={onTabAbschluss} />}
        {zoom === 'monat' && <CalendarScreen embedded onOpenBeleg={onOpenBeleg} onTabAbschluss={onTabAbschluss} />}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import {
  format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameWeek, getISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektFilter } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { BelegCard } from '../components/BelegCard';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { OffeneBanner } from '../components/OffeneBanner';
import type { Bewirtungsbeleg } from '../types';
import s from './WeekScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; onTabAbschluss: () => void; }

/** Sortierung: aufsteigend nach uhrzeitVon, leere Uhrzeiten ans Ende */
function byUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg): number {
  return (a.uhrzeitVon || '99:99').localeCompare(b.uhrzeitVon || '99:99');
}

export function WeekScreen({ onOpenBeleg, onTabAbschluss }: Props) {
  const belege          = useBelegStore(st => st.belege);
  const { matchObjekt } = useObjektFilter();
  const rolle           = useAuthStore(st => st.user?.rolle);
  // offset: 0 = aktuelle Woche, -1 = vorige, +1 = nächste …
  const [offset, setOffset] = useState(0);

  const base       = addWeeks(new Date(), offset);
  const weekStart  = startOfWeek(base, { weekStartsOn: 1 }); // Montag
  const weekEnd    = endOfWeek(base,   { weekStartsOn: 1 }); // Sonntag
  const days       = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const istDieseWoche = isSameWeek(base, new Date(), { weekStartsOn: 1 });

  // Sichtbar nur Belege der dem Nutzer zugeordneten Objekte.
  const belegeForObjekt = belege.filter(b => !b.deleted && matchObjekt(b.objektId));

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');
  const weekBelege   = belegeForObjekt.filter(
    b => b.cateringDatumVon >= weekStartStr && b.cateringDatumVon <= weekEndStr
  );

  const spanLabel = `${format(weekStart, 'd.', { locale: de })}–${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;

  return (
    <div className={s.screen}>
      {/* ── Header ── */}
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>🗓️ Woche</span>
        {rolle !== 'geschaeftsfuehrung' && (
          <div className={s.headerRight}>
            <ObjektSwitcherButton />
          </div>
        )}
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* ── Wochen-Navigator ── */}
      <div className={s.weekNav}>
        <button className={s.navBtn} onClick={() => setOffset(o => o - 1)} type="button" aria-label="Vorige Woche">‹</button>
        <div className={s.weekLabelWrap}>
          <span className={s.weekKw}>KW {getISOWeek(weekStart)}</span>
          <span className={s.weekSpan}>{spanLabel}</span>
        </div>
        <button className={s.navBtn} onClick={() => setOffset(o => o + 1)} type="button" aria-label="Nächste Woche">›</button>
      </div>

      {offset !== 0 && (
        <button className={s.backToWeek} onClick={() => setOffset(0)} type="button">
          ↩ Zurück zu dieser Woche
        </button>
      )}

      {/* ── Tage Montag bis Sonntag — je Tag eine Spalte ── */}
      <div className={s.columns}>
        {days.map(day => {
          const key      = format(day, 'yyyy-MM-dd');
          const dayBelege = weekBelege.filter(b => b.cateringDatumVon === key).toSorted(byUhrzeit);
          const heute    = isToday(day);
          return (
            <div key={key} className={`${s.column} ${heute ? s.columnToday : ''}`}>
              <div className={`${s.dayHeader} ${heute ? s.dayHeaderToday : ''}`}>
                <span className={s.dayName}>{format(day, 'EEEEEE', { locale: de })}</span>
                <span className={s.dayDate}>{format(day, 'd. MMM', { locale: de })}</span>
                <span className={s.dayCount}>{dayBelege.length}</span>
              </div>
              <div className={s.columnList}>
                {dayBelege.length === 0
                  ? <p className={s.dayEmpty}>—</p>
                  : dayBelege.map(b => (
                      <BelegCard key={b.id} beleg={b} onClick={() => onOpenBeleg(b)} />
                    ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

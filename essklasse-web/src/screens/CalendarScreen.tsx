import { useState, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, parseISO, isToday,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { BelegCard } from '../components/BelegCard';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { OffeneBanner } from '../components/OffeneBanner';
import type { Bewirtungsbeleg } from '../types';

function byUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg): number {
  const ta = a.uhrzeitVon || '99:99';
  const tb = b.uhrzeitVon || '99:99';
  return ta.localeCompare(tb);
}
import s from './CalendarScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; onTabAbschluss: () => void; }

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function CalendarScreen({ onOpenBeleg, onTabAbschluss }: Props) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState(format(new Date(), 'yyyy-MM-dd'));
  const belege        = useBelegStore(st => st.belege);
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  const belegeForObjekt = useMemo(
    () => belege.filter(b => !aktivesObjekt || b.objektId === aktivesObjekt.id),
    [belege, aktivesObjekt]
  );
  const datesWithBelege = useMemo(
    () => [...new Set(belegeForObjekt.map(b => b.cateringDatumVon))],
    [belegeForObjekt]
  );
  const dayBelege = useMemo(
    () => belegeForObjekt.filter(b => b.cateringDatumVon === selected).sort(byUhrzeit),
    [belegeForObjekt, selected]
  );

  const monthStart = startOfMonth(viewDate);
  const monthEnd   = endOfMonth(viewDate);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = (getDay(monthStart) + 6) % 7;

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  return (
    <div className={s.screen}>
      {/* Header mit Logo + Switcher + Profil */}
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <div className={s.headerRight}>
          <ObjektSwitcherButton />
        </div>
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* Monatsnavigation */}
      <div className={s.monthNav}>
        <button onClick={prevMonth} className={s.navBtn} type="button">‹</button>
        <span className={s.monthLabel}>{format(viewDate, 'MMMM yyyy', { locale: de })}</span>
        <button onClick={nextMonth} className={s.navBtn} type="button">›</button>
      </div>

      {/* Kalender-Grid */}
      <div className={s.grid}>
        {WEEKDAYS.map(d => <div key={d} className={s.wdHeader}>{d}</div>)}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const hasBelege = datesWithBelege.includes(key);
          const isSelected = key === selected;
          const todayCell = isToday(day);
          return (
            <button
              key={key}
              className={[s.dayCell, isSelected ? s.selected : '', todayCell ? s.today : ''].join(' ')}
              onClick={() => setSelected(key)}
              type="button"
            >
              {format(day, 'd')}
              {hasBelege && <span className={s.dot} />}
            </button>
          );
        })}
      </div>

      {/* Tagesüberschrift */}
      <div className={s.dayHeader}>
        <span>{format(parseISO(selected), "EEEE, d. MMMM", { locale: de })}</span>
        <span className={s.cntBadge}>{dayBelege.length}</span>
      </div>

      <div className={s.list}>
        {dayBelege.length === 0
          ? <p className={s.empty}>Keine Bewirtungen an diesem Tag.</p>
          : dayBelege.map(b => <BelegCard key={b.id} beleg={b} onClick={() => onOpenBeleg(b)} />)
        }
      </div>
    </div>
  );
}

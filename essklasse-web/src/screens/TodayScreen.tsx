import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { format, addDays, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { BelegCard, type BelegHighlight } from '../components/BelegCard';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { OffeneBanner } from '../components/OffeneBanner';
import type { Bewirtungsbeleg } from '../types';
import s from './TodayScreen.module.css';

interface Props {
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
  onAbschliessen: (b: Bewirtungsbeleg) => void;
  onTabAbschluss: () => void;
}

/** Sortierung: aufsteigend nach uhrzeitVon, leere Uhrzeiten ans Ende */
function byUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg): number {
  return (a.uhrzeitVon || '99:99').localeCompare(b.uhrzeitVon || '99:99');
}

/** Aktuell laufend: jetzt liegt zwischen uhrzeitVon und uhrzeitBis */
function isRunning(beleg: Bewirtungsbeleg, now: string): boolean {
  if (!beleg.uhrzeitVon || !beleg.uhrzeitBis) return false;
  return beleg.uhrzeitVon <= now && now < beleg.uhrzeitBis;
}

/** Als nächstes: uhrzeitVon liegt in der Zukunft */
function isFuture(beleg: Bewirtungsbeleg, now: string): boolean {
  if (!beleg.uhrzeitVon) return false;
  return beleg.uhrzeitVon > now;
}

export function TodayScreen({ onOpenBeleg, onAbschliessen, onTabAbschluss }: Props) {
  const belege        = useBelegStore(st => st.belege);
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  const rolle = useAuthStore(st => st.user?.rolle);
  // offset: Basis-Tag (0 = heute ist linker Button, 1 = morgen ist linker Button, …)
  const [offset, setOffset]   = useState(0);
  const [selected, setSelected] = useState<0 | 1>(0); // 0 = linker Button, 1 = rechter Button

  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const leftDate    = addDays(todayBase, offset);
  const rightDate   = addDays(todayBase, offset + 1);
  const leftDateStr  = format(leftDate,  'yyyy-MM-dd');
  const rightDateStr = format(rightDate, 'yyyy-MM-dd');
  const nowTime     = format(new Date(), 'HH:mm');

  const leftIsToday  = isToday(leftDate);
  const rightIsToday = isToday(rightDate);

  function dayTitle(date: Date, idx: number): string {
    const weekday = format(date, 'EEEE', { locale: de });
    if (isToday(date)) return `Heute, ${weekday}`;
    if (idx === 1 && isToday(addDays(date, -1))) return `Morgen, ${weekday}`;
    return weekday;
  }
  function dateShort(date: Date): string {
    return format(date, 'EEE, d. MMM', { locale: de });
  }

  const selectedDate    = selected === 0 ? leftDate    : rightDate;
  const isSelectedToday = selected === 0 ? leftIsToday : rightIsToday;

  // React Compiler übernimmt die Memoisierung automatisch – kein manuelles useMemo nötig.
  const belegeForObjekt = belege.filter(b => !b.deleted && (!aktivesObjekt || b.objektId === aktivesObjekt.id));

  const leftBelege  = belegeForObjekt.filter(b => b.cateringDatumVon === leftDateStr).toSorted(byUhrzeit);
  const rightBelege = belegeForObjekt.filter(b => b.cateringDatumVon === rightDateStr).toSorted(byUhrzeit);
  const selectedBelege = selected === 0 ? leftBelege : rightBelege;

  const nextBelegId = isSelectedToday
    ? (selectedBelege.find(b => isFuture(b, nowTime))?.id ?? null)
    : null;

  function getHighlight(beleg: Bewirtungsbeleg): BelegHighlight {
    if (!isSelectedToday) return null;
    if (isRunning(beleg, nowTime)) return 'running';
    if (beleg.id === nextBelegId)  return 'next';
    return null;
  }

  const sectionLabel = `Bewirtungen – ${dayTitle(selectedDate, selected === 0 ? offset : offset + 1)}`;
  const emptyText    = `Keine Bewirtungen am ${format(selectedDate, 'd. MMMM', { locale: de })}`;

  return (
    <div className={s.screen}>
      {/* ── Header ── */}
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>📋 Heute</span>
        {rolle !== 'geschaeftsfuehrung' && (
          <div className={s.headerRight}>
            <ObjektSwitcherButton />
          </div>
        )}
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* ── Datums-Navigator ── */}
      <div className={s.navigator}>
        <button
          className={s.navArrow}
          onClick={() => { setOffset(o => Math.max(0, o - 1)); setSelected(0); }}
          disabled={offset === 0}
          type="button"
          aria-label="Zurück"
        >‹</button>

        <button
          className={`${s.counterBtn} ${selected === 0 ? s.counterActive : s.counterInactive}`}
          onClick={() => setSelected(0)}
          type="button"
        >
          <span className={s.counterLabel}>{dayTitle(leftDate, offset)}</span>
          <span className={s.counterNum}>{leftBelege.length}</span>
          <span className={s.counterDate}>{dateShort(leftDate)}</span>
        </button>

        <button
          className={`${s.counterBtn} ${selected === 1 ? s.counterActive : s.counterInactive}`}
          onClick={() => setSelected(1)}
          type="button"
        >
          <span className={s.counterLabel}>{dayTitle(rightDate, offset + 1)}</span>
          <span className={s.counterNum}>{rightBelege.length}</span>
          <span className={s.counterDate}>{dateShort(rightDate)}</span>
        </button>

        <button
          className={s.navArrow}
          onClick={() => { setOffset(o => o + 1); setSelected(0); }}
          type="button"
          aria-label="Weiter"
        >›</button>
      </div>

      {offset > 0 && (
        <button className={s.backToToday} onClick={() => { setOffset(0); setSelected(0); }} type="button">
          ↩ Zurück zu Heute
        </button>
      )}

      <div className={s.sectionHeader}>
        <div className={s.sectionLine} />
        <span className={s.sectionLabel}>{sectionLabel}</span>
        <div className={s.sectionLine} />
      </div>

      <div className={s.list}>
        {selectedBelege.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>🍽️</div>
            <h3>{emptyText}</h3>
            <p>Tippe unten auf + um einen Bewirtungsbeleg anzulegen.</p>
          </div>
        ) : (
          selectedBelege.map(b => (
            <BelegCard
              key={b.id}
              beleg={b}
              onClick={() => onOpenBeleg(b)}
              highlight={getHighlight(b)}
              onAbschliessen={!b.abgeschlossen ? () => onAbschliessen(b) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

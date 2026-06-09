import { useMemo, useState } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
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
  // offset in Tagen ab heute (0 = heute, 1 = morgen, …); min = 0
  const [offset, setOffset] = useState(0);

  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const selectedDate    = addDays(todayBase, offset);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const nowTime         = format(new Date(), 'HH:mm');

  const isSelectedToday = isToday(selectedDate);
  const dayLabel = isSelectedToday
    ? 'Heute'
    : offset === 1
      ? 'Morgen'
      : format(selectedDate, 'EEEE', { locale: de });
  const dateLabel = format(selectedDate, 'EEE, d. MMMM yyyy', { locale: de });

  const belegeForObjekt = useMemo(
    () => belege.filter(b => !b.deleted && (!aktivesObjekt || b.objektId === aktivesObjekt.id)),
    [belege, aktivesObjekt]
  );

  const selectedBelege = useMemo(
    () => belegeForObjekt.filter(b => b.cateringDatumVon === selectedDateStr).sort(byUhrzeit),
    [belegeForObjekt, selectedDateStr]
  );

  const pendingCount = useMemo(
    () => belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error').length,
    [belege]
  );

  // Highlight-Logik: nur für heute
  const nextBelegId = useMemo(() => {
    if (!isSelectedToday) return null;
    const future = selectedBelege.filter(b => isFuture(b, nowTime));
    return future[0]?.id ?? null;
  }, [selectedBelege, nowTime, isSelectedToday]);

  function getHighlight(beleg: Bewirtungsbeleg): BelegHighlight {
    if (!isSelectedToday) return null;
    if (isRunning(beleg, nowTime)) return 'running';
    if (beleg.id === nextBelegId)  return 'next';
    return null;
  }

  const sectionLabel = isSelectedToday
    ? 'Heutige Bewirtungen'
    : `Bewirtungen am ${format(selectedDate, 'd. MMM', { locale: de })}`;
  const emptyText = isSelectedToday
    ? 'Noch keine Bewirtungen heute'
    : `Keine Bewirtungen am ${format(selectedDate, 'd. MMMM', { locale: de })}`;

  return (
    <div className={s.screen}>
      {/* ── Header ── */}
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <div className={s.headerRight}>
          <ObjektSwitcherButton />
          {pendingCount > 0 && <div className={s.syncBadge}>☁️ {pendingCount}</div>}
        </div>
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* ── Datums-Navigator ── */}
      <div className={s.navigator}>
        <button
          className={s.navArrow}
          onClick={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0}
          type="button"
          aria-label="Vorheriger Tag"
        >
          ‹
        </button>

        <div className={s.navCenter}>
          <div className={s.navDayLabel}>{dayLabel}</div>
          <div className={s.navCount}>{selectedBelege.length}</div>
          <div className={s.navDateLabel}>{dateLabel}</div>
        </div>

        <button
          className={s.navArrow}
          onClick={() => setOffset(o => o + 1)}
          type="button"
          aria-label="Nächster Tag"
        >
          ›
        </button>
      </div>

      {/* Zurück zu Heute – nur sichtbar wenn nicht heute */}
      {offset > 0 && (
        <button className={s.backToToday} onClick={() => setOffset(0)} type="button">
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

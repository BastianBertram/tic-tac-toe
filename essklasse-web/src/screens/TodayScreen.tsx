import { useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { BelegCard, type BelegHighlight } from '../components/BelegCard';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { ProfilButton } from '../components/ProfilSheet';
import type { Bewirtungsbeleg } from '../types';
import s from './TodayScreen.module.css';

interface Props {
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
  onAbschliessen: (b: Bewirtungsbeleg) => void;
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

export function TodayScreen({ onOpenBeleg, onAbschliessen }: Props) {
  const belege        = useBelegStore(st => st.belege);
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  const [view, setView] = useState<'today' | 'tomorrow'>('today');

  const today    = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), "EEE, d. MMM yyyy", { locale: de });
  const nowTime  = format(new Date(), 'HH:mm');   // z.B. "09:35"

  const belegeForObjekt = useMemo(
    () => belege.filter(b => !aktivesObjekt || b.objektId === aktivesObjekt.id),
    [belege, aktivesObjekt]
  );

  const todaysBelege    = useMemo(() => belegeForObjekt.filter(b => b.cateringDatumVon === today).sort(byUhrzeit),    [belegeForObjekt, today]);
  const tomorrowsBelege = useMemo(() => belegeForObjekt.filter(b => b.cateringDatumVon === tomorrow).sort(byUhrzeit), [belegeForObjekt, tomorrow]);
  const pendingCount    = useMemo(() => belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error').length, [belege]);

  // Highlight-Logik: nur für Heute
  const nextBelegId = useMemo(() => {
    const future = todaysBelege.filter(b => isFuture(b, nowTime));
    return future[0]?.id ?? null;   // erster in der Zukunft (bereits nach Uhrzeit sortiert)
  }, [todaysBelege, nowTime]);

  function getHighlight(beleg: Bewirtungsbeleg): BelegHighlight {
    if (view !== 'today') return null;
    if (isRunning(beleg, nowTime)) return 'running';
    if (beleg.id === nextBelegId)  return 'next';
    return null;
  }

  const activeBelege = view === 'today' ? todaysBelege : tomorrowsBelege;
  const activeLabel  = view === 'today' ? 'Heutige Bewirtungen' : 'Bewirtungen morgen';
  const emptyText    = view === 'today' ? 'Noch keine Bewirtungen heute' : 'Noch keine Bewirtungen morgen';

  return (
    <div className={s.screen}>
      {/* ── Header ── */}
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <div className={s.headerRight}>
          <ObjektSwitcherButton />
          {pendingCount > 0 && <div className={s.syncBadge}>☁️ {pendingCount}</div>}
          <ProfilButton />
        </div>
      </div>

      <div className={s.dateRow}>{todayStr}</div>

      {/* ── Zähler-Buttons ── */}
      <div className={s.counters}>
        <button
          className={`${s.counterBtn} ${view === 'today' ? s.counterActive : s.counterInactive}`}
          onClick={() => setView('today')} type="button"
        >
          <span className={s.counterNum}>{todaysBelege.length}</span>
          <span className={s.counterLabel}>Heute</span>
        </button>
        <button
          className={`${s.counterBtn} ${view === 'tomorrow' ? s.counterActive : s.counterInactive}`}
          onClick={() => setView('tomorrow')} type="button"
        >
          <span className={s.counterNum}>{tomorrowsBelege.length}</span>
          <span className={s.counterLabel}>Morgen</span>
        </button>
      </div>

      <div className={s.sectionHeader}>
        <div className={s.sectionLine} />
        <span className={s.sectionLabel}>{activeLabel}</span>
        <div className={s.sectionLine} />
      </div>

      <div className={s.list}>
        {activeBelege.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>🍽️</div>
            <h3>{emptyText}</h3>
            <p>Tippe unten auf + um einen Bewirtungsbeleg anzulegen.</p>
          </div>
        ) : (
          activeBelege.map(b => (
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

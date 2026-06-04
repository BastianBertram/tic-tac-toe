import { useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { BelegCard } from '../components/BelegCard';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { ProfilButton } from '../components/ProfilSheet';
import type { Bewirtungsbeleg } from '../types';

/** Sortierung: aufsteigend nach Uhrzeit (HH:MM), leere Uhrzeiten ans Ende */
function byUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg): number {
  const ta = a.uhrzeitVon || '99:99';
  const tb = b.uhrzeitVon || '99:99';
  return ta.localeCompare(tb);
}
import s from './TodayScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; }

export function TodayScreen({ onOpenBeleg }: Props) {
  const belege         = useBelegStore(st => st.belege);
  const aktivesObjekt  = useObjektStore(st => st.getAktivesObjekt());
  const [view, setView] = useState<'today' | 'tomorrow'>('today');

  const today    = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), "EEE, d. MMM yyyy", { locale: de });

  // Filter nach aktivem Objekt
  const belegeForObjekt = useMemo(
    () => belege.filter(b => !aktivesObjekt || b.objektId === aktivesObjekt.id),
    [belege, aktivesObjekt]
  );

  const todaysBelege    = useMemo(() => belegeForObjekt.filter(b => b.cateringDatumVon === today).sort(byUhrzeit),    [belegeForObjekt, today]);
  const tomorrowsBelege = useMemo(() => belegeForObjekt.filter(b => b.cateringDatumVon === tomorrow).sort(byUhrzeit), [belegeForObjekt, tomorrow]);
  const pendingCount    = useMemo(() => belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error').length, [belege]);

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

      {/* Datum */}
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
          activeBelege.map(b => <BelegCard key={b.id} beleg={b} onClick={() => onOpenBeleg(b)} />)
        )}
      </div>
    </div>
  );
}

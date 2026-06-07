import React, { useMemo, useState } from 'react';
import { useBelegStore } from '../store/belegStore';
import { format } from 'date-fns';
import s from './BottomNav.module.css';
import { HamburgerDrawer } from './HamburgerDrawer';

export type Tab = 'today' | 'calendar' | 'abschluss';
interface Props { active: Tab; onTab: (t: Tab) => void; onNew: () => void; onAbgeschlossene: () => void; }

export function BottomNav({ active, onTab, onNew, onAbgeschlossene }: Props) {
  const belege = useBelegStore(st => st.belege);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pending = useMemo(
    () => belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error').length,
    [belege]
  );
  const offene = useMemo(() => {
    const now   = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');
    return belege.filter(b => {
      if (b.abgeschlossen) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
      return false;
    }).length;
  }, [belege]);

  return (
    <>
      <nav className={s.nav}>
        {/* Links: Hamburger + Kalender */}
        <button className={`${s.tab} ${drawerOpen ? s.tabActive : ''}`} onClick={() => setDrawerOpen(true)} type="button">
          <span className={s.hamburger}>
            <span /><span /><span />
          </span>
          <span className={s.tabLabel}>Menü</span>
        </button>
        <TabBtn icon="📋" label="Heute" active={active === 'today'} onClick={() => onTab('today')} />

        {/* Mitte: FAB */}
        <button className={s.fab} onClick={onNew} type="button" aria-label="Neuer Beleg">
          <span className={s.fabPlus}>+</span>
        </button>

        {/* Rechts: Kalender + Abschließen */}
        <TabBtn icon="📅" label="Kalender" active={active === 'calendar'} onClick={() => onTab('calendar')} badge={pending} />
        <TabBtn icon="✓" label={<>Bewirtung<br />Abschließen</>} active={active === 'abschluss'} onClick={() => onTab('abschluss')} badge={offene} urgent={offene > 0} />
      </nav>

      {drawerOpen && (
        <HamburgerDrawer
          onClose={() => setDrawerOpen(false)}
          onAbgeschlossene={onAbgeschlossene}
        />
      )}
    </>
  );
}

function TabBtn({ icon, label, active, onClick, badge = 0, urgent = false }: {
  icon: string; label: React.ReactNode; active: boolean;
  onClick: () => void; badge?: number; urgent?: boolean;
}) {
  return (
    <button
      className={`${s.tab} ${active ? s.tabActive : ''} ${urgent && !active ? s.tabUrgent : ''}`}
      onClick={onClick} type="button"
    >
      <span className={s.tabIcon}>{icon}</span>
      <span className={s.tabLabel}>{label}</span>
      {badge > 0 && (
        <span className={`${s.badge} ${urgent ? s.badgeUrgent : ''}`}>{badge}</span>
      )}
    </button>
  );
}

import React, { useMemo, useState } from 'react';
import { useBelegStore } from '../store/belegStore';
import { useObjektFilter } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import s from './BottomNav.module.css';
import { HamburgerDrawer } from './HamburgerDrawer';

export type Tab = 'bewirtungen' | 'abschluss' | 'admin' | 'gf-home' | 'gf-statistik';
interface Props { active: Tab; onTab: (t: Tab) => void; onNew: () => void; onAbgeschlossene: () => void; }

export function BottomNav({ active, onTab, onNew, onAbgeschlossene }: Props) {
  const belege = useBelegStore(st => st.belege);
  const { matchObjekt } = useObjektFilter();
  const rolle = useAuthStore(st => st.user?.rolle);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const offene = useMemo(() => {
    const now   = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');
    return belege.filter(b => {
      if (b.deleted || b.abgeschlossen) return false;
      if (!matchObjekt(b.objektId)) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
      return false;
    }).length;
  }, [belege, matchObjekt]);

  const isGf = rolle === 'geschaeftsfuehrung';

  return (
    <>
      <nav className={s.nav}>
        <button className={`${s.tab} ${drawerOpen ? s.tabActive : ''}`} onClick={() => setDrawerOpen(true)} type="button">
          <span className={s.hamburger}>
            <span /><span /><span />
          </span>
          <span className={s.tabLabel}>Menü</span>
        </button>
        {/* Heute/Woche/Kalender sind unter „Bewirtungen" zusammengefasst (Zeit-Zoom). */}
        <TabBtn icon="📋" label="Bewirtungen" active={active === 'bewirtungen'} onClick={() => onTab('bewirtungen')} hidden={isGf} />

        {isGf ? (
          <button
            className={`${s.fab} ${active === 'gf-home' ? s.fabHome : ''}`}
            onClick={() => onTab('gf-home')}
            type="button"
            aria-label="Home"
          >
            <span className={s.fabHomeIcon}>🏠</span>
          </button>
        ) : (
          <button className={s.fab} onClick={onNew} type="button" aria-label="Neuer Beleg">
            <span className={s.fabPlus}>+</span>
          </button>
        )}

        {isGf && (
          <TabBtn icon="📊" label="Statistik" active={active === 'gf-statistik'} onClick={() => onTab('gf-statistik')} />
        )}
        {rolle === 'admin' ? (
          <TabBtn icon="⚙️" label={<>Admin<br />Verwaltung</>} active={active === 'admin'} onClick={() => onTab('admin')} hidden={isGf} />
        ) : (
          <TabBtn icon="✓" label={<>Bewirtung<br />Abschließen</>} active={active === 'abschluss'} onClick={() => onTab('abschluss')} badge={offene} urgent={offene > 0} hidden={isGf} />
        )}
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

function TabBtn({ icon, label, active, onClick, badge = 0, urgent = false, hidden = false }: {
  icon: string; label: React.ReactNode; active: boolean;
  onClick: () => void; badge?: number; urgent?: boolean; hidden?: boolean;
}) {
  return (
    <button
      className={`${s.tab} ${active ? s.tabActive : ''} ${urgent && !active ? s.tabUrgent : ''}`}
      onClick={onClick} type="button"
      style={hidden ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
    >
      <span className={s.tabIcon}>{icon}</span>
      <span className={s.tabLabel}>{label}</span>
      {badge > 0 && (
        <span className={`${s.badge} ${urgent ? s.badgeUrgent : ''}`}>{badge}</span>
      )}
    </button>
  );
}

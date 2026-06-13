import React, { useMemo, useState } from 'react';
import { useBelegStore } from '../store/belegStore';
import { useAngeboteStore } from '../store/angeboteStore';
import { useObjektFilter } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import s from './BottomNav.module.css';
import { HamburgerDrawer } from './HamburgerDrawer';

export type Tab = 'bewirtungen' | 'abschluss' | 'admin' | 'gf-home' | 'gf-statistik' | 'gf-freigaben';
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
  const angebote = useAngeboteStore(st => st.angebote);
  const freigaben = useMemo(
    () => angebote.filter(a => !a.deleted && a.genehmigungErforderlich && !a.genehmigtVon).length,
    [angebote]
  );

  return (
    <>
      <nav className={`${s.nav} ${!isGf ? s.navCentered : ''}`}>
        <button
          className={`${s.tab} ${drawerOpen ? s.tabActive : ''} ${!isGf ? s.menuCorner : ''}`}
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <span className={s.hamburger}>
            <span /><span /><span />
          </span>
          <span className={s.tabLabel}>Menü</span>
        </button>
        {/* Heute/Woche/Kalender sind unter „Bewirtungen" zusammengefasst (Zeit-Zoom). */}
        <TabBtn icon="📋" label="Bewirtungen" active={active === 'bewirtungen'} onClick={() => onTab('bewirtungen')} hidden={isGf} compact={!isGf} />

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
        {isGf ? (
          <TabBtn icon="📄" label={<>Angebote<br />Freigeben</>} active={active === 'gf-freigaben'} onClick={() => onTab('gf-freigaben')} badge={freigaben} urgent={freigaben > 0} />
        ) : rolle === 'admin' ? (
          <TabBtn icon="⚙️" label={<>Admin<br />Verwaltung</>} active={active === 'admin'} onClick={() => onTab('admin')} hidden={isGf} compact={!isGf} />
        ) : (
          <TabBtn icon="✓" label={<>Bewirtung<br />Abschließen</>} active={active === 'abschluss'} onClick={() => onTab('abschluss')} badge={offene} urgent={offene > 0} hidden={isGf} compact={!isGf} />
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

function TabBtn({ icon, label, active, onClick, badge = 0, urgent = false, hidden = false, compact = false }: {
  icon: string; label: React.ReactNode; active: boolean;
  onClick: () => void; badge?: number; urgent?: boolean; hidden?: boolean; compact?: boolean;
}) {
  return (
    <button
      className={`${s.tab} ${compact ? s.tabCompact : ''} ${active ? s.tabActive : ''} ${urgent && !active ? s.tabUrgent : ''}`}
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

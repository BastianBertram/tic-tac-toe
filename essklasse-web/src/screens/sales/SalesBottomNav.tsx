import React from 'react';
import s from '../../components/BottomNav.module.css';

export type SalesTab = 'home' | 'pipeline' | 'kunden' | 'statistik';

interface Props {
  active: SalesTab;
  onTab: (t: SalesTab) => void;
  onNew: () => void;
}

export function SalesBottomNav({ active, onTab, onNew }: Props) {
  return (
    <nav className={s.nav}>
      <TabBtn icon="🏠" label="Home"     active={active === 'home'}     onClick={() => onTab('home')} />
      <TabBtn icon="📈" label="Pipeline" active={active === 'pipeline'} onClick={() => onTab('pipeline')} />

      <button className={s.fab} onClick={onNew} type="button" aria-label="Neue Anfrage">
        <span className={s.fabPlus}>+</span>
      </button>

      <TabBtn icon="🤝" label="Kunden"    active={active === 'kunden'}    onClick={() => onTab('kunden')} />
      <TabBtn icon="📊" label="Statistik" active={active === 'statistik'} onClick={() => onTab('statistik')} />
    </nav>
  );
}

function TabBtn({ icon, label, active, onClick }: {
  icon: string; label: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button className={`${s.tab} ${active ? s.tabActive : ''}`} onClick={onClick} type="button">
      <span className={s.tabIcon}>{icon}</span>
      <span className={s.tabLabel}>{label}</span>
    </button>
  );
}

import { useBelegStore } from '../store/belegStore';
import s from './BottomNav.module.css';

export type Tab = 'today' | 'calendar';
interface Props { active: Tab; onTab: (t: Tab) => void; onNew: () => void; }

export function BottomNav({ active, onTab, onNew }: Props) {
  const belege = useBelegStore(s => s.belege);
  const pending = belege.filter(b => b.syncStatus === 'local' || b.syncStatus === 'error').length;

  return (
    <nav className={s.nav}>
      <button className={`${s.tab} ${active === 'today' ? s.tabActive : ''}`}
        onClick={() => onTab('today')} type="button">
        <span className={s.tabIcon}>📋</span>
        <span className={s.tabLabel}>Heute</span>
      </button>

      <button className={s.fab} onClick={onNew} type="button" aria-label="Neuer Beleg">
        <span className={s.fabPlus}>+</span>
      </button>

      <button className={`${s.tab} ${active === 'calendar' ? s.tabActive : ''}`}
        onClick={() => onTab('calendar')} type="button">
        <span className={s.tabIcon}>📅</span>
        <span className={s.tabLabel}>Kalender</span>
        {pending > 0 && <span className={s.badge}>{pending}</span>}
      </button>
    </nav>
  );
}

import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import type { Tab } from './components/BottomNav';
import { AuthGuard } from './components/AuthGuard';
import { TodayScreen } from './screens/TodayScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { NewBelegScreen } from './screens/NewBelegScreen';
import { DetailScreen } from './screens/DetailScreen';
import { AbschlussScreen } from './screens/AbschlussScreen';
import { AbschlussListScreen } from './screens/AbschlussListScreen';
import { AbgeschlossenScreen } from './screens/AbgeschlossenScreen';
import { BuchhaltungScreen } from './screens/BuchhaltungScreen';
import { AdminScreen } from './screens/AdminScreen';
import { useAuthStore } from './store/authStore';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import type { Bewirtungsbeleg } from './types';
import s from './App.module.css';

type View =
  | { type: 'main' }
  | { type: 'new' }
  | { type: 'detail';        beleg: Bewirtungsbeleg }
  | { type: 'abschluss';     beleg: Bewirtungsbeleg }
  | { type: 'abgeschlossen' }
  | { type: 'edit'; beleg: Bewirtungsbeleg };

export default function App() {
  const [tab, setTab]   = useState<Tab>('today');
  const [view, setView] = useState<View>({ type: 'main' });
  const rolle = useAuthStore(st => st.user?.rolle);

  function openBeleg(b: Bewirtungsbeleg) { setView({ type: 'detail', beleg: b }); }
  function openAbschluss(b: Bewirtungsbeleg) { setView({ type: 'abschluss', beleg: b }); }
  function closeView() { setView({ type: 'main' }); }

  if (view.type === 'edit') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <NewBelegScreen
            editBeleg={view.beleg}
            onClose={() => setView({ type: 'detail', beleg: view.beleg })}
          />
        </div>
      </AuthGuard>
    );
  }

  if (view.type === 'abgeschlossen') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <AbgeschlossenScreen
            onClose={closeView}
            onOpenBeleg={beleg => setView({ type: 'detail', beleg })}
          />
        </div>
      </AuthGuard>
    );
  }

  if (view.type === 'new') {
    return <AuthGuard><div className={s.app}><NewBelegScreen onClose={closeView} /></div></AuthGuard>;
  }

  if (view.type === 'detail') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <DetailScreen
            beleg={view.beleg}
            onClose={closeView}
            onAbschliessen={rolle !== 'buchhaltung' ? () => openAbschluss(view.beleg) : undefined}
            onBearbeiten={rolle !== 'buchhaltung' ? () => setView({ type: 'edit', beleg: view.beleg }) : undefined}
          />
        </div>
      </AuthGuard>
    );
  }

  if (view.type === 'abschluss') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <AbschlussScreen
            beleg={view.beleg}
            onClose={() => setView({ type: 'detail', beleg: view.beleg })}
            onDone={closeView}
          />
        </div>
      </AuthGuard>
    );
  }

  // ── Buchhaltung ──
  if (rolle === 'buchhaltung') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <div className={s.content}>
            <BuchhaltungScreen onOpenBeleg={openBeleg} />
          </div>
          <BuchhaltungNav />
          <DevOverlay />
        </div>
      </AuthGuard>
    );
  }

  // ── User / Admin ──
  return (
    <AuthGuard>
      <div className={s.app}>
        <div className={s.content}>
          {tab === 'today'     && <TodayScreen     onOpenBeleg={openBeleg} onAbschliessen={openAbschluss} onTabAbschluss={() => setTab('abschluss')} />}
          {tab === 'calendar'  && <CalendarScreen  onOpenBeleg={openBeleg} onTabAbschluss={() => setTab('abschluss')} />}
          {tab === 'abschluss' && <AbschlussListScreen onOpenBeleg={openBeleg} />}
          {tab === 'admin'     && <AdminScreen />}
        </div>
        <BottomNav
          active={tab} onTab={setTab} onNew={() => setView({ type: 'new' })}
          onAbgeschlossene={() => setView({ type: 'abgeschlossen' })}
        />
        <DevOverlay />
      </div>
    </AuthGuard>
  );
}

function DevOverlay() {
  if (!import.meta.env.DEV) return null;
  return <DevRoleSwitcher />;
}

function BuchhaltungNav() {
  const logout = useAuthStore(st => st.logout);
  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 60, background: 'var(--ek-surface)', borderTop: '1px solid var(--ek-border)',
      flexShrink: 0,
    }}>
      <button type="button" onClick={logout} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 11, color: 'var(--ek-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}>
        <span style={{ fontSize: 20 }}>🚪</span>Abmelden
      </button>
    </nav>
  );
}

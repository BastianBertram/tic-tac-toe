import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import type { Tab } from './components/BottomNav';
import { AuthGuard } from './components/AuthGuard';
import { TodayScreen } from './screens/TodayScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { NewBelegScreen } from './screens/NewBelegScreen';
import { DetailScreen } from './screens/DetailScreen';
import type { Bewirtungsbeleg } from './types';
import s from './App.module.css';

type View = { type: 'main' } | { type: 'new' } | { type: 'detail'; beleg: Bewirtungsbeleg };

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [view, setView] = useState<View>({ type: 'main' });

  function openBeleg(b: Bewirtungsbeleg) { setView({ type: 'detail', beleg: b }); }
  function closeView() { setView({ type: 'main' }); }

  if (view.type === 'new') {
    return <AuthGuard><div className={s.app}><NewBelegScreen onClose={closeView} /></div></AuthGuard>;
  }
  if (view.type === 'detail') {
    return <AuthGuard><div className={s.app}><DetailScreen beleg={view.beleg} onClose={closeView} /></div></AuthGuard>;
  }

  return (
    <AuthGuard>
      <div className={s.app}>
        <div className={s.content}>
          {tab === 'today'    && <TodayScreen    onOpenBeleg={openBeleg} />}
          {tab === 'calendar' && <CalendarScreen onOpenBeleg={openBeleg} />}
        </div>
        <BottomNav active={tab} onTab={setTab} onNew={() => setView({ type: 'new' })} />
      </div>
    </AuthGuard>
  );
}

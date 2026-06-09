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
import { useBelegStore } from './store/belegStore';
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
  const user = useAuthStore(st => st.user);
  const markRechnung = useBelegStore(st => st.markRechnungErstellt);

  // Modal für Rechnungsnummer-Eingabe (Buchhaltung)
  const [rechnungModalBeleg, setRechnungModalBeleg] = useState<Bewirtungsbeleg | null>(null);
  const [rechnungsnummerInput, setRechnungsnummerInput] = useState('');

  function openRechnungModal(b: Bewirtungsbeleg) {
    setRechnungsnummerInput(b.rechnungsnummer ?? '');
    setRechnungModalBeleg(b);
  }
  function confirmRechnung() {
    if (!rechnungModalBeleg || !rechnungsnummerInput.trim()) return;
    markRechnung(rechnungModalBeleg.id, user?.name, rechnungsnummerInput.trim());
    setRechnungModalBeleg(null);
    setRechnungsnummerInput('');
  }

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
            onRechnungErstellen={rolle === 'buchhaltung' ? openRechnungModal : undefined}
            canDelete={rolle !== 'buchhaltung'}
          />
          {rechnungModalBeleg && (
            <RechnungNummerModal
              beleg={rechnungModalBeleg}
              value={rechnungsnummerInput}
              onChange={setRechnungsnummerInput}
              onConfirm={confirmRechnung}
              onCancel={() => setRechnungModalBeleg(null)}
            />
          )}
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
          <BuchhaltungScreen onOpenBeleg={openBeleg} onRechnungErstellen={openRechnungModal} />
          <DevOverlay />
          {rechnungModalBeleg && (
            <RechnungNummerModal
              beleg={rechnungModalBeleg}
              value={rechnungsnummerInput}
              onChange={setRechnungsnummerInput}
              onConfirm={confirmRechnung}
              onCancel={() => setRechnungModalBeleg(null)}
            />
          )}
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

function RechnungNummerModal({ beleg, value, onChange, onConfirm, onCancel }: {
  beleg: Bewirtungsbeleg;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 300, padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div style={{
        background: 'var(--ek-surface)', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px', width: '100%', maxWidth: 480,
        boxShadow: '0 -4px 32px rgba(0,0,0,.18)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ek-charcoal)', marginBottom: 4 }}>
          Rechnung erstellen
        </div>
        <div style={{ fontSize: 13, color: 'var(--ek-muted)', marginBottom: 20 }}>
          {beleg.veranstaltung || 'Bewirtung'} · {beleg.bestellungsnummer}
        </div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ek-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Rechnungsnummer <span style={{ color: '#e74c3c' }}>*</span>
        </label>
        <input
          autoFocus
          type="text"
          placeholder="z.B. R260001"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && onConfirm()}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            border: '1.5px solid var(--ek-border)',
            background: 'var(--ek-bg)', fontSize: 15,
            color: 'var(--ek-charcoal)', marginBottom: 20,
            outline: value.trim() ? 'none' : '1.5px solid #e74c3c',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid var(--ek-border)',
            background: 'var(--ek-bg)', fontSize: 14, fontWeight: 700,
            color: 'var(--ek-muted)', cursor: 'pointer',
          }}>
            Abbrechen
          </button>
          <button type="button" onClick={onConfirm} disabled={!value.trim()} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: value.trim() ? 'linear-gradient(135deg,#2d8a4e,#3aab62)' : '#ccc',
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: value.trim() ? 'pointer' : 'not-allowed',
            boxShadow: value.trim() ? '0 4px 16px rgba(45,138,78,.3)' : 'none',
          }}>
            ✅ Rechnung erstellen
          </button>
        </div>
      </div>
    </div>
  );
}


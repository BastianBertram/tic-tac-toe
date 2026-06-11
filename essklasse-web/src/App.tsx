import { useState, useEffect } from 'react';
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
import { GFHomeScreen } from './screens/GFHomeScreen';
import { GFBewirtungsListScreen } from './screens/GFBewirtungsListScreen';
import type { GFKategorie } from './screens/GFBewirtungsListScreen';
import { GFStatistikScreen } from './screens/GFStatistikScreen';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { DuplikatCheckModal } from './components/DuplikatCheckModal';
import { seedAll } from './dev/seedData';
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

  // Im DEV-Modus einmalig Testdaten einspielen (nur wenn noch leer)
  useEffect(() => {
    if (import.meta.env.DEV) {
      const { belege } = useBelegStore.getState();
      if (belege.length === 0) seedAll();
    }
  }, []);

  // Duplikat-Prüfung + Rechnungsnummer-Modal
  const [duplikatBeleg, setDuplikatBeleg] = useState<Bewirtungsbeleg | null>(null);
  const [rechnungModalBeleg, setRechnungModalBeleg] = useState<Bewirtungsbeleg | null>(null);
  const [rechnungsnummerInput, setRechnungsnummerInput] = useState('');

  function openRechnungModal(b: Bewirtungsbeleg) {
    setDuplikatBeleg(b);
  }
  function proceedToRechnungModal(b: Bewirtungsbeleg) {
    setDuplikatBeleg(null);
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

  // ── Buchhaltung: eigener Zweig, BuchhaltungScreen bleibt immer gemountet ──
  // ── Buchhaltung ──
  if (rolle === 'buchhaltung') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <BuchhaltungScreen onOpenBeleg={openBeleg} onRechnungErstellen={openRechnungModal} />
          {view.type === 'detail' && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--ek-bg)', display: 'flex', flexDirection: 'column' }}>
              <DetailScreen beleg={view.beleg} onClose={closeView} onRechnungErstellen={openRechnungModal} canDelete={false} />
            </div>
          )}
          <DevOverlay />
          {duplikatBeleg && (
            <DuplikatCheckModal
              beleg={duplikatBeleg}
              onProceed={() => proceedToRechnungModal(duplikatBeleg)}
              onCancel={() => setDuplikatBeleg(null)}
            />
          )}
          {rechnungModalBeleg && (
            <RechnungNummerModal beleg={rechnungModalBeleg} value={rechnungsnummerInput}
              onChange={setRechnungsnummerInput} onConfirm={confirmRechnung} onCancel={() => setRechnungModalBeleg(null)} />
          )}
        </div>
      </AuthGuard>
    );
  }

  // ── Admin ──
  if (rolle === 'admin') {
    return (
      <AuthGuard>
        <div className={s.app}>
          <AdminScreen />
          <DevOverlay />
        </div>
      </AuthGuard>
    );
  }

  // ── Geschäftsführung ──
  if (rolle === 'geschaeftsfuehrung') {
    return (
      <AuthGuard>
        <GFApp />
        <DevOverlay />
      </AuthGuard>
    );
  }

  // ── User / Bereichsleitung: view-basiertes Routing ──
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
            onAbschliessen={() => openAbschluss(view.beleg)}
            onBearbeiten={() => setView({ type: 'edit', beleg: view.beleg })}
            canDelete
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

  // ── User / Bereichsleitung ──
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

function GFApp() {
  const [gfTab, setGfTab]           = useState<'gf-home' | 'gf-statistik'>('gf-home');
  const [kategorie, setKategorie]   = useState<GFKategorie | null>(null);
  const [detailBeleg, setDetailBeleg] = useState<Bewirtungsbeleg | null>(null);

  function handleTab(t: Tab) {
    if (t === 'gf-home' || t === 'gf-statistik') {
      setGfTab(t);
      setKategorie(null);
      setDetailBeleg(null);
    }
  }

  if (detailBeleg) {
    return (
      <div className={s.app}>
        <DetailScreen beleg={detailBeleg} onClose={() => setDetailBeleg(null)} canDelete={false} />
      </div>
    );
  }

  return (
    <div className={s.app}>
      <div className={s.content}>
        {gfTab === 'gf-statistik'
          ? <GFStatistikScreen />
          : kategorie
            ? <GFBewirtungsListScreen kategorie={kategorie} onClose={() => setKategorie(null)} onOpenBeleg={setDetailBeleg} />
            : <GFHomeScreen onKachelClick={setKategorie} />
        }
      </div>
      <BottomNav
        active={gfTab}
        onTab={handleTab}
        onNew={() => {}}
        onAbgeschlossene={() => {}}
      />
    </div>
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
  const belege = useBelegStore(st => st.belege);

  const trimmed = value.trim();
  const validFormat = /^R\d{2,}$/i.test(trimmed);
  const isDuplicate = validFormat && belege.some(
    b => b.id !== beleg.id && b.rechnungsnummer?.toLowerCase() === trimmed.toLowerCase()
  );
  const hasError = trimmed.length > 0 && (!validFormat || isDuplicate);
  const canSubmit = validFormat && !isDuplicate;

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
        <div style={{ fontSize: 12, color: '#1a5c30', background: '#eafaf1', border: '1px solid #a9dfbf', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          ℹ️ Bitte die Rechnungsnummer aus <strong>Business Central</strong> eintragen.
        </div>
        <input
          autoFocus
          type="text"
          placeholder="z.B. R260001"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canSubmit && onConfirm()}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            border: '1.5px solid var(--ek-border)',
            background: 'var(--ek-bg)', fontSize: 15,
            color: 'var(--ek-charcoal)', marginBottom: hasError ? 8 : 20,
            outline: hasError ? '1.5px solid #e74c3c' : !trimmed ? '1.5px solid #e74c3c' : 'none',
          }}
        />
        {hasError && (
          <div style={{
            marginBottom: 16, padding: '8px 12px', borderRadius: 8,
            background: '#fdecea', color: '#e74c3c',
            fontSize: 12, fontWeight: 600, border: '1px solid #f5c6c6',
          }}>
            {isDuplicate
              ? '⚠️ Diese Rechnungsnummer ist bereits vergeben.'
              : '⚠️ Ungültiges Format — die Rechnungsnummer muss mit „R" beginnen und mindestens zwei Ziffern enthalten (z.B. R260001).'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: 14, borderRadius: 12, border: '1.5px solid var(--ek-border)',
            background: 'var(--ek-bg)', fontSize: 14, fontWeight: 700,
            color: 'var(--ek-muted)', cursor: 'pointer',
          }}>
            Abbrechen
          </button>
          <button type="button" onClick={canSubmit ? onConfirm : undefined} disabled={!canSubmit} style={{
            flex: 2, padding: 14, borderRadius: 12, border: 'none',
            background: canSubmit ? 'linear-gradient(135deg,#2d8a4e,#3aab62)' : '#ccc',
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 4px 16px rgba(45,138,78,.3)' : 'none',
          }}>
            ✅ Rechnung erstellen
          </button>
        </div>
      </div>
    </div>
  );
}


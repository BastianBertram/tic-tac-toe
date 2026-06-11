import { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { useAuthStore }  from '../store/authStore';
import { useObjektStore } from '../store/objektStore';
import { LoginScreen }   from '../screens/LoginScreen';

interface Props { children: React.ReactNode; }

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function AuthGuard({ children }: Props) {
  const { user, setAuth } = useAuthStore();
  const setObjekte        = useObjektStore(s => s.setObjekte);
  // Wenn schon ein User im Store ist, ist der Check bereits erledigt (kein Refresh nötig)
  const [checked, setChecked] = useState(!!user);

  useEffect(() => {
    if (user) {
      // In Produktion: Objekte per API laden → GET /api/me/objekte
      // Demo: Fallback-Objekte setzen falls keine vorhanden
      const stored = useObjektStore.getState().objekte;
      if (stored.length === 0) {
        setObjekte([
          { id: 'demo-1', name: 'HWK Hannover Hauptgebäude', kuerzel: 'HWK-01', strasse: 'Berliner Allee 17', plz: '30175', ort: 'Hannover', kostenstellen: ['KST-100'], aktiv: true },
          { id: 'demo-2', name: 'Berufsschulzentrum Nord',   kuerzel: 'BSZ-N',  strasse: 'Podbielskistr. 22', plz: '30163', ort: 'Hannover', kostenstellen: ['KST-200'], aktiv: true },
        ]);
      }
      return; // checked ist bereits true (Initialwert)
    }

    // Im Dev-Modus ohne Backend: direkt als Demo-User anmelden.
    // queueMicrotask hält den State-Update aus dem synchronen Effekt-Body heraus.
    if (import.meta.env.DEV) {
      queueMicrotask(() => {
        setAuth(
          { id: 'demo-user', name: 'Anna Schmidt', email: 'anna@hwk.de', rolle: 'user', objektIds: ['demo-1'] },
          'dev-token',
        );
        setChecked(true);
      });
      return;
    }

    // Magic-Link aus der E-Mail? → /auth/verify, sonst stille Sitzungs-Erneuerung.
    const token = new URLSearchParams(window.location.search).get('token');
    const request = token
      ? fetch(`${BASE}/auth/verify`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      : fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });

    request
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accessToken) {
          setAuth(data.user, data.accessToken);
          if (data.objekte) setObjekte(data.objekte);
        }
      })
      .catch(() => {})
      .finally(() => {
        // Token aus der URL entfernen, damit er nicht im Verlauf / beim Reload bleibt.
        if (token) window.history.replaceState({}, '', window.location.pathname);
        setChecked(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: 'var(--ek-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <BrandLogo style={{ height: 40, marginBottom: 16, opacity: .6 }} />
          <p style={{ color: 'var(--ek-muted)', fontSize: 14 }}>Wird geladen …</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

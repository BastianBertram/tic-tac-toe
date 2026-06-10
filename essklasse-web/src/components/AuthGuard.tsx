import { useEffect, useState } from 'react';
import { useAuthStore }  from '../store/authStore';
import { useObjektStore } from '../store/objektStore';
import { LoginScreen }   from '../screens/LoginScreen';

interface Props { children: React.ReactNode; }

const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

export function AuthGuard({ children }: Props) {
  const { user, setAuth } = useAuthStore();
  const setObjekte        = useObjektStore(s => s.setObjekte);
  const [checked, setChecked] = useState(false);

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
      setChecked(true);
      return;
    }

    fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accessToken) {
          setAuth(data.user, data.accessToken);
          // Objekte nach erfolgreichem Refresh laden
          if (data.objekte) setObjekte(data.objekte);
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: 'var(--ek-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.webp" alt="EssKlasse" style={{ height: 40, marginBottom: 16, opacity: .6 }} />
          <p style={{ color: 'var(--ek-muted)', fontSize: 14 }}>Wird geladen …</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Im Dev-Modus: Login überspringen, direkt als Demo-User einloggen
    if (import.meta.env.DEV) {
      setAuth(
        { id: 'demo-user', name: 'Anna Schmidt', email: 'anna@hwk.de', rolle: 'user', objektIds: ['demo-1'] },
        'dev-token'
      );
      return null;
    }
    return <LoginScreen />;
  }

  return <>{children}</>;
}

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { seedAll, clearAll } from '../dev/seedData';
import type { UserRolle } from '../types';

const ROLES: { rolle: UserRolle; label: string; color: string; user: object }[] = [
  {
    rolle: 'user',
    label: 'User',
    color: '#2e86c1',
    user: { id: 'demo-user', name: 'Anna Schmidt', email: 'anna@hwk.de', rolle: 'user', objektIds: ['demo-1'] },
  },
  {
    rolle: 'admin',
    label: 'Admin',
    color: '#922b21',
    user: { id: 'demo-admin', name: 'Max Mustermann', email: 'max@hwk.de', rolle: 'admin' },
  },
  {
    rolle: 'buchhaltung',
    label: 'Buchhaltung',
    color: '#1a5276',
    user: { id: 'demo-buch', name: 'Klaus Weber', email: 'buch@hwk.de', rolle: 'buchhaltung' },
  },
];

export function DevRoleSwitcher() {
  const [open, setOpen] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const { user, setAuth } = useAuthStore();

  function handleSeed() {
    const result = seedAll();
    setSeedMsg(`✓ ${result.belege} Belege, ${result.users} User, ${result.objekte} Objekte`);
    setTimeout(() => setSeedMsg(''), 3000);
  }
  function handleClear() {
    clearAll();
    setSeedMsg('🗑 Belege gelöscht');
    setTimeout(() => setSeedMsg(''), 2000);
  }

  function switchRole(entry: typeof ROLES[0]) {
    setAuth(entry.user as any, 'dev-token');
    window.location.reload();
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 12, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {open && ROLES.map(r => (
        <button
          key={r.rolle}
          type="button"
          onClick={() => switchRole(r)}
          style={{
            padding: '7px 14px', borderRadius: 20, border: 'none',
            background: user?.rolle === r.rolle ? r.color : '#fff',
            color: user?.rolle === r.rolle ? '#fff' : r.color,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.18)',
            outline: `2px solid ${r.color}`,
          }}
        >
          {user?.rolle === r.rolle ? '✓ ' : ''}{r.label}
        </button>
      ))}
      {seedMsg && (
        <div style={{
          padding: '6px 12px', borderRadius: 10, background: '#222', color: '#aef',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        }}>
          {seedMsg}
        </div>
      )}
      {open && (
        <>
          <button type="button" onClick={handleSeed} style={{
            padding: '7px 14px', borderRadius: 20, border: 'none',
            background: '#2d8a4e', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.18)',
          }}>
            🌱 Testdaten
          </button>
          <button type="button" onClick={handleClear} style={{
            padding: '7px 14px', borderRadius: 20, border: 'none',
            background: '#922b21', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.18)',
          }}>
            🗑 Belege löschen
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Dev: Rolle wechseln"
        style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: '#333', color: '#fff', fontSize: 18, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,.3)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        🔧
      </button>
    </div>
  );
}

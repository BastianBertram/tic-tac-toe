import { useAuthStore, type AuthUser } from '../store/authStore';
import type { UserRolle } from '../types';

const ROLES: { rolle: UserRolle; label: string; color: string; user: AuthUser }[] = [
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
  {
    rolle: 'bereichsleitung',
    label: 'Bereichsltg.',
    color: '#6c3483',
    user: { id: 'demo-bl', name: 'Maria Berger', email: 'berger@hwk.de', rolle: 'bereichsleitung', objektIds: ['demo-1', 'demo-2'] },
  },
  {
    rolle: 'geschaeftsfuehrung',
    label: 'GF',
    color: '#1e6b4a',
    user: { id: 'demo-gf', name: 'Hans Müller', email: 'gf@hwk.de', rolle: 'geschaeftsfuehrung' },
  },
  {
    rolle: 'sales',
    label: 'Sales',
    color: '#b9770e',
    user: { id: 'demo-sales', name: 'Lena Vogel', email: 'sales@hwk.de', rolle: 'sales' },
  },
];

export function DevRoleSwitcher() {
  const { user, setAuth } = useAuthStore();

  function switchRole(entry: typeof ROLES[0]) {
    setAuth(entry.user, 'dev-token');
    window.location.reload();
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 12, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {ROLES.map(r => (
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
    </div>
  );
}

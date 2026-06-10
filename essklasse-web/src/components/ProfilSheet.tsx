import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useObjektStore } from '../store/objektStore';
import s from './ProfilSheet.module.css';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function ProfilButton() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore(st => st.user);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() ?? '?';

  return (
    <>
      <button className={s.avatarBtn} onClick={() => setOpen(true)} type="button" aria-label="Profil">
        <span className={s.avatarText}>{initials}</span>
      </button>
      {open && <ProfilModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProfilModal({ onClose }: { onClose: () => void }) {
  const user    = useAuthStore(st => st.user);
  const logout  = useAuthStore(st => st.logout);
  const resetObjekte = useObjektStore(st => st.reset);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ''}` },
      });
    } catch { /* ignore – logout locally regardless */ }
    logout();
    resetObjekte();
    onClose();
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() ?? '?';

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <div className={s.sheetHandle} />

        {/* Avatar + Name */}
        <div className={s.profileHead}>
          <div className={s.avatarLarge}>{initials}</div>
          <div>
            <div className={s.profileName}>{user?.name || '—'}</div>
            <div className={s.profileEmail}>{user?.email}</div>
            {user?.rolle === 'admin' && (
              <span className={s.adminBadge}>Administrator</span>
            )}
          </div>
        </div>

        <div className={s.divider} />

        {/* Aktive Objekte Info */}
        <ObjekteInfo />

        <div className={s.divider} />

        {/* Logout */}
        <button
          className={s.logoutBtn}
          onClick={handleLogout}
          disabled={loading}
          type="button"
        >
          {loading ? '⏳ Wird abgemeldet …' : '🚪 Abmelden'}
        </button>

        <button className={s.cancelBtn} onClick={onClose} type="button">
          Schließen
        </button>
      </div>
    </div>
  );
}

function ObjekteInfo() {
  const objekte = useObjektStore(st => st.objekte);
  const aktiv   = useObjektStore(st => st.getAktivesObjekt());

  if (objekte.length === 0) return null;

  return (
    <div className={s.objekteInfo}>
      <div className={s.objekteLabel}>Zugeordnete Objekte</div>
      {objekte.map(o => (
        <div key={o.id} className={`${s.objektItem} ${o.id === aktiv?.id ? s.objektActive : ''}`}>
          <span className={s.objektKuerzel}>{o.kuerzel ?? '🏢'}</span>
          <span className={s.objektName}>{o.name}</span>
          {o.id === aktiv?.id && <span className={s.objektAktivLabel}>aktiv</span>}
        </div>
      ))}
    </div>
  );
}

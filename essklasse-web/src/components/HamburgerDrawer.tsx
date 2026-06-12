import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useObjektStore } from '../store/objektStore';
import type { UserRolle } from '../types';
import s from './ProfilSheet.module.css';
import d from './HamburgerDrawer.module.css';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface Props {
  onClose: () => void;
  onAbgeschlossene: () => void;
}

const GF_ROLLEN: { rolle: UserRolle; label: string; icon: string; color: string }[] = [
  { rolle: 'geschaeftsfuehrung', label: 'Geschäftsführung', icon: '👔', color: '#1e6b4a' },
  { rolle: 'user',               label: 'User',             icon: '👤', color: '#2e86c1' },
  { rolle: 'bereichsleitung',    label: 'Bereichsleitung',  icon: '🏛️', color: '#6c3483' },
  { rolle: 'buchhaltung',        label: 'Buchhaltung',      icon: '📊', color: '#1a5276' },
  { rolle: 'admin',              label: 'Admin',            icon: '⚙️', color: '#922b21' },
];

export function HamburgerDrawer({ onClose, onAbgeschlossene }: Props) {
  const user              = useAuthStore(st => st.user);
  const logout            = useAuthStore(st => st.logout);
  const switchRolleAs     = useAuthStore(st => st.switchRolleAs);
  const isGfBase          = useAuthStore(st => st.isGeschaeftsfuehrungBase());
  const resetObjekte      = useObjektStore(st => st.reset);
  const objekte           = useObjektStore(st => st.objekte);
  const aktiv             = useObjektStore(st => st.getAktivesObjekt());
  const setAktiveObjektId = useObjektStore(st => st.setAktiveObjektId);
  const isBuchhaltung     = user?.rolle === 'buchhaltung';
  const isAdmin           = user?.rolle === 'admin';
  const isGf              = user?.rolle === 'geschaeftsfuehrung';
  const [loading, setLoading] = useState(false);

  function handleRolleSwitch(rolle: UserRolle) {
    switchRolleAs(rolle);
    onClose();
    window.location.reload();
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ''}` },
      });
    } catch { /* ignore */ }
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

        {/* Profil-Kopf */}
        <div className={s.profileHead}>
          <div className={s.avatarLarge}>{initials}</div>
          <div>
            <div className={s.profileName}>{user?.name || '—'}</div>
            <div className={s.profileEmail}>{user?.email}</div>
            {user?.rolle === 'admin'              && <span className={s.adminBadge}>Administrator</span>}
            {user?.rolle === 'bereichsleitung'   && <span className={s.adminBadge} style={{ background: '#6c3483' }}>Bereichsleitung</span>}
            {user?.rolle === 'geschaeftsfuehrung' && <span className={s.adminBadge} style={{ background: '#1e6b4a' }}>Geschäftsführung</span>}
            {isGfBase && user?.baseRolle && <span className={s.adminBadge} style={{ background: '#1e6b4a', marginLeft: 4 }}>GF</span>}
          </div>
        </div>

        <div className={s.divider} />

        {/* Objekte — nur für User (nicht Admin, nicht Buchhaltung, nicht GF) */}
        {!isBuchhaltung && !isAdmin && !isGf && objekte.length > 0 && (
          <>
            <div className={s.objekteInfo}>
              <div className={s.objekteLabel}>Zugeordnete Objekte</div>
              {objekte.map(o => {
                const istAktiv = o.id === aktiv?.id;
                const wechselbar = objekte.length > 1;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { if (!istAktiv) setAktiveObjektId(o.id); }}
                    disabled={!wechselbar}
                    className={`${s.objektItem} ${istAktiv ? s.objektActive : ''}`}
                    style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: wechselbar && !istAktiv ? 'pointer' : 'default' }}
                  >
                    <span className={s.objektKuerzel}>{o.kuerzel ?? '🏢'}</span>
                    <span className={s.objektName}>{o.name}</span>
                    <span className={s.objektAktivLabel}>{istAktiv ? 'aktiv' : (wechselbar ? 'wechseln' : '')}</span>
                  </button>
                );
              })}
            </div>
            <div className={s.divider} />
          </>
        )}

        {/* Abgeschlossene Bewirtungen — nur für User (nicht GF) */}
        {!isBuchhaltung && !isAdmin && !isGf && (
          <>
            <button
              className={d.abgeschlosseneBtn}
              onClick={() => { onClose(); onAbgeschlossene(); }}
              type="button"
            >
              ✅ Abgeschlossene Bewirtungen
            </button>
            <div className={s.divider} />
          </>
        )}

        {/* Rollenwechsel — nur für Geschäftsführung */}
        {isGfBase && (
          <>
            <div className={s.divider} />
            <div className={d.rolleSection}>
              <div className={d.rolleSectionTitle}>Rolle wechseln</div>
              {GF_ROLLEN.map(r => (
                <button
                  key={r.rolle}
                  type="button"
                  className={`${d.rolleBtn} ${user?.rolle === r.rolle ? d.rolleBtnActive : ''}`}
                  style={user?.rolle === r.rolle ? { borderColor: r.color, background: r.color } : { borderColor: r.color + '55' }}
                  onClick={() => handleRolleSwitch(r.rolle)}
                >
                  <span className={d.rolleBtnIcon}>{r.icon}</span>
                  <span className={d.rolleBtnLabel} style={{ color: user?.rolle === r.rolle ? '#fff' : r.color }}>
                    {r.label}
                  </span>
                  {user?.rolle === r.rolle && <span className={d.rolleBtnCheck}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Logout */}
        <button className={s.logoutBtn} onClick={handleLogout} disabled={loading} type="button">
          {loading ? '⏳ Wird abgemeldet …' : '🚪 Abmelden'}
        </button>
        <button className={s.cancelBtn} onClick={onClose} type="button">Schließen</button>
      </div>
    </div>
  );
}

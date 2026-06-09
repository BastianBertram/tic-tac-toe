import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../store/userStore';
import { useObjektStore } from '../store/objektStore';
import { HamburgerDrawer } from '../components/HamburgerDrawer';
import type { UserRolle, Anrede } from '../types';
import s from './AdminScreen.module.css';

type AdminTab = 'user' | 'objekte';
type FilterStatus = 'aktiv' | 'inaktiv' | 'alle';

const ROLLE_LABELS: Record<UserRolle, string> = {
  user: 'User',
  admin: 'Admin',
  buchhaltung: 'Buchhaltung',
};

const ROLLE_COLORS: Record<UserRolle, string> = {
  user: '#2e86c1',
  admin: '#922b21',
  buchhaltung: '#1a5276',
};

/* ─── Zweistufiges Bestätigungs-Modal ─── */
interface ConfirmStep {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}

interface ConfirmModalProps {
  steps: [ConfirmStep, ConfirmStep];
  onConfirmed: () => void;
  onCancel: () => void;
}

function ConfirmModal({ steps, onConfirmed, onCancel }: ConfirmModalProps) {
  const [step, setStep] = useState<0 | 1>(0);
  const current = steps[step];

  return (
    <div className={s.modalOverlay} onClick={onCancel}>
      <div className={s.modalSheet} onClick={e => e.stopPropagation()}>
        <div className={s.modalStep}>Schritt {step + 1} von 2</div>
        <div className={s.modalTitle}>{current.title}</div>
        <div className={s.modalBody}>{current.body}</div>
        <div className={s.modalActions}>
          <button type="button" className={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
          <button
            type="button"
            className={current.danger ? s.dangerBtn : s.saveBtn}
            onClick={() => step === 0 ? setStep(1) : onConfirmed()}
          >
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Haupt-Screen ─── */
export function AdminScreen() {
  const [tab, setTab] = useState<AdminTab>('user');
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.headerSection}>
          {tab === 'user' ? '👤 Benutzer' : '🏢 Objekte'}
        </span>
        <div className={s.headerRight}>
          <span className={s.rolleChip}>Admin</span>
        </div>
      </div>

      {tab === 'user'    && <UserTab />}
      {tab === 'objekte' && <ObjekteTab />}

      <nav className={s.nav}>
        <button type="button" className={s.hamburgerBtn} onClick={() => setDrawerOpen(true)}>
          <span className={s.hamburger}><span /><span /><span /></span>
          <span className={s.navLabel}>Menü</span>
        </button>
        <button type="button" className={`${s.navTab} ${tab === 'user' ? s.navTabActive : ''}`} onClick={() => setTab('user')}>
          <span className={s.navTabIcon}>👤</span>
          <span className={s.navTabLabel}>Benutzer</span>
        </button>
        <button type="button" className={`${s.navTab} ${tab === 'objekte' ? s.navTabActive : ''}`} onClick={() => setTab('objekte')}>
          <span className={s.navTabIcon}>🏢</span>
          <span className={s.navTabLabel}>Objekte</span>
        </button>
      </nav>

      {drawerOpen && (
        <HamburgerDrawer onClose={() => setDrawerOpen(false)} onAbgeschlossene={() => {}} />
      )}
    </div>
  );
}

/* ─── User Tab ─── */
function UserTab() {
  const { users, addUser, updateUser, toggleAktiv } = useUserStore();
  const objekte = useObjektStore(st => st.objekte);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = { anrede: 'Herr' as Anrede, vorname: '', nachname: '', email: '', telefon: '', rolle: 'user' as UserRolle, objektIds: [] as string[] };
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('aktiv');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  function openNew() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  }
  function openEdit(u: typeof users[0]) {
    setForm({
      anrede: u.anrede ?? 'Herr',
      vorname: u.vorname ?? '',
      nachname: u.nachname ?? '',
      email: u.email,
      telefon: u.telefon ?? '',
      rolle: u.rolle,
      objektIds: u.objektIds,
    });
    setEditId(u.id);
    setShowForm(true);
  }
  const canSave = form.vorname.trim() && form.nachname.trim() && form.email.trim();
  function handleSave() {
    if (!canSave) return;
    if (editId) updateUser(editId, { anrede: form.anrede, vorname: form.vorname, nachname: form.nachname, email: form.email, telefon: form.telefon, rolle: form.rolle, objektIds: form.objektIds });
    else        addUser(form);
    setShowForm(false);
  }
  function toggleObjekt(id: string) {
    setForm(f => ({
      ...f,
      objektIds: f.objektIds.includes(id) ? f.objektIds.filter(x => x !== id) : [...f.objektIds, id],
    }));
  }

  const editTarget = editId ? users.find(u => u.id === editId) : null;

  const q = search.toLowerCase();
  const filtered = users.filter(u => {
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchFilter = filter === 'alle' || (filter === 'aktiv' ? u.aktiv : !u.aktiv);
    return matchSearch && matchFilter;
  });

  const countAktiv   = users.filter(u => u.aktiv).length;
  const countInaktiv = users.filter(u => !u.aktiv).length;

  return (
    <div className={s.tabContent}>
      <div className={s.searchRow}>
        <input
          className={s.searchInput}
          type="text"
          placeholder="Name oder E-Mail suchen …"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button type="button" className={s.searchClear} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={s.listHeader}>
        <div className={s.filterChips}>
          {(['aktiv', 'inaktiv', 'alle'] as FilterStatus[]).map(f => (
            <button key={f} type="button"
              className={`${s.filterChip} ${filter === f ? s.filterChipActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'aktiv' ? `Aktiv (${countAktiv})` : f === 'inaktiv' ? `Inaktiv (${countInaktiv})` : 'Alle'}
            </button>
          ))}
        </div>
        <button type="button" className={s.addBtn} onClick={openNew}>+ Neuer Benutzer</button>
      </div>

      {showForm && (
        <div className={s.formCard}>
          <div className={s.formTitle}>{editId ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</div>

          <label className={s.label}>Anrede *</label>
          <div className={s.anredeRow}>
            {(['Herr', 'Frau'] as Anrede[]).map(a => (
              <button key={a} type="button"
                className={`${s.anredeBtn} ${form.anrede === a ? s.anredeBtnActive : ''}`}
                onClick={() => setForm(f => ({...f, anrede: a}))}
              >{a}</button>
            ))}
          </div>

          <label className={s.label}>Vorname *</label>
          <input className={s.input} value={form.vorname} onChange={e => setForm(f => ({...f, vorname: e.target.value}))} placeholder="Vorname" />

          <label className={s.label}>Nachname *</label>
          <input className={s.input} value={form.nachname} onChange={e => setForm(f => ({...f, nachname: e.target.value}))} placeholder="Nachname" />

          <label className={s.label}>E-Mail *</label>
          <input className={s.input} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="name@hwk.de" />

          <label className={s.label}>Telefonnummer</label>
          <input className={s.input} type="tel" value={form.telefon} onChange={e => setForm(f => ({...f, telefon: e.target.value}))} placeholder="+49 511 123456" />

          <label className={s.label}>Rolle *</label>
          <select className={s.select} value={form.rolle} onChange={e => setForm(f => ({...f, rolle: e.target.value as UserRolle}))}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="buchhaltung">Buchhaltung</option>
          </select>

          {form.rolle === 'user' && objekte.length > 0 && (
            <>
              <label className={s.label}>Objekte zuordnen *</label>
              <div className={s.objektCheckList}>
                {objekte.filter(o => o.aktiv !== false).map(o => (
                  <label key={o.id} className={s.checkRow}>
                    <input type="checkbox" checked={form.objektIds.includes(o.id)} onChange={() => toggleObjekt(o.id)} />
                    <span>{o.kuerzel ? `${o.kuerzel} – ` : ''}{o.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Deaktivieren — nur bei bestehenden aktiven Usern */}
          {editId && editTarget?.aktiv && (
            <>
              <div className={s.dividerLine} />
              <button
                type="button"
                className={s.deactivateBtn}
                onClick={() => setConfirmDeactivate(true)}
              >
                🔒 Benutzer deaktivieren
              </button>
            </>
          )}
          <div className={s.formActions}>
            <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Abbrechen</button>
            {/* Inaktive User können nur gespeichert werden (kein Reaktivieren) */}
            {(!editId || editTarget?.aktiv) && (
              <button type="button" className={s.saveBtn} onClick={handleSave} disabled={!canSave}>Speichern</button>
            )}
            {editId && !editTarget?.aktiv && (
              <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Schließen</button>
            )}
          </div>
        </div>
      )}

      <div className={s.list}>
        {filtered.length === 0 && <div className={s.emptyState}>Keine Benutzer gefunden</div>}
        {filtered.map(u => (
          <div key={u.id} className={`${s.userRow} ${!u.aktiv ? s.userRowInaktiv : ''}`}>
            <div className={s.userAvatar} style={{ background: ROLLE_COLORS[u.rolle] }}>
              {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className={s.userInfo}>
              <div className={s.userName}>{u.anrede ? `${u.anrede} ` : ''}{u.name}</div>
              <div className={s.userEmail}>{u.email}</div>
              {u.telefon && <div className={s.userEmail}>{u.telefon}</div>}
              {u.rolle === 'user' && u.objektIds.length > 0 && (
                <div className={s.userObjekte}>
                  {u.objektIds.map(id => {
                    const o = objekte.find(x => x.id === id);
                    return o ? <span key={id} className={s.objektTag}>{o.kuerzel ?? o.name}</span> : null;
                  })}
                </div>
              )}
            </div>
            <div className={s.userRight}>
              <span className={s.rolleChipSmall} style={{ background: ROLLE_COLORS[u.rolle] }}>
                {ROLLE_LABELS[u.rolle]}
              </span>
              <div className={s.userActions}>
                <button type="button" className={s.iconBtn} onClick={() => openEdit(u)} title="Bearbeiten">✏️</button>
                {!u.aktiv && <span className={s.inaktivLabel}>Inaktiv</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Zweistufige Bestätigung Benutzer deaktivieren */}
      {confirmDeactivate && editTarget && (
        <ConfirmModal
          steps={[
            {
              title: 'Benutzer deaktivieren?',
              body: `„${editTarget.name}" wird deaktiviert und kann sich nicht mehr anmelden.`,
              confirmLabel: 'Weiter →',
            },
            {
              title: 'Wirklich endgültig deaktivieren?',
              body: `Dieser Schritt kann nicht rückgängig gemacht werden. „${editTarget.name}" muss vom Admin neu angelegt werden, um wieder Zugang zu erhalten.`,
              confirmLabel: 'Ja, endgültig deaktivieren',
              danger: true,
            },
          ]}
          onConfirmed={() => {
            toggleAktiv(editTarget.id);
            setConfirmDeactivate(false);
            setShowForm(false);
          }}
          onCancel={() => setConfirmDeactivate(false)}
        />
      )}
    </div>
  );
}

/* ─── Objekte Tab ─── */
function ObjekteTab() {
  const { objekte, setObjekte, updateObjekt, toggleAktiv } = useObjektStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', adresse: '', kuerzel: '' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('aktiv');
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; toAktiv: boolean } | null>(null);

  function openNew() { setForm({ name: '', adresse: '', kuerzel: '' }); setEditId(null); setShowForm(true); }
  function openEdit(o: typeof objekte[0]) {
    setForm({ name: o.name, adresse: o.adresse ?? '', kuerzel: o.kuerzel ?? '' });
    setEditId(o.id);
    setShowForm(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editId) {
      updateObjekt(editId, { name: form.name, adresse: form.adresse, kuerzel: form.kuerzel });
    } else {
      setObjekte([...objekte, { id: uuidv4(), name: form.name, adresse: form.adresse, kuerzel: form.kuerzel, aktiv: true }]);
    }
    setShowForm(false);
  }

  const q = search.toLowerCase();
  const filtered = objekte.filter(o => {
    const matchSearch = !q || o.name.toLowerCase().includes(q) || (o.kuerzel ?? '').toLowerCase().includes(q);
    const isAktiv = o.aktiv !== false;
    const matchFilter = filter === 'alle' || (filter === 'aktiv' ? isAktiv : !isAktiv);
    return matchSearch && matchFilter;
  });

  const countAktiv   = objekte.filter(o => o.aktiv !== false).length;
  const countInaktiv = objekte.filter(o => o.aktiv === false).length;

  const editObj    = editId ? objekte.find(o => o.id === editId) : null;
  const confirmObj = confirmTarget ? objekte.find(o => o.id === confirmTarget.id) : null;

  return (
    <div className={s.tabContent}>
      <div className={s.searchRow}>
        <input
          className={s.searchInput}
          type="text"
          placeholder="Objekt suchen …"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button type="button" className={s.searchClear} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={s.listHeader}>
        <div className={s.filterChips}>
          {(['aktiv', 'inaktiv', 'alle'] as FilterStatus[]).map(f => (
            <button key={f} type="button"
              className={`${s.filterChip} ${filter === f ? s.filterChipActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'aktiv' ? `Aktiv (${countAktiv})` : f === 'inaktiv' ? `Inaktiv (${countInaktiv})` : 'Alle'}
            </button>
          ))}
        </div>
        <button type="button" className={s.addBtn} onClick={openNew}>+ Neues Objekt</button>
      </div>

      {showForm && (
        <div className={s.formCard}>
          <div className={s.formTitle}>{editId ? 'Objekt bearbeiten' : 'Neues Objekt'}</div>
          <label className={s.label}>Kürzel (z.B. HWK-01)</label>
          <input className={s.input} value={form.kuerzel} onChange={e => setForm(f => ({...f, kuerzel: e.target.value}))} placeholder="HWK-01" />
          <label className={s.label}>Name *</label>
          <input className={s.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="HWK Hannover Hauptgebäude" />
          <label className={s.label}>Adresse</label>
          <input className={s.input} value={form.adresse} onChange={e => setForm(f => ({...f, adresse: e.target.value}))} placeholder="Berliner Allee 17, 30175 Hannover" />

          {/* De-/Aktivieren — nur bei bestehenden Objekten */}
          {editId && editObj && (
            <>
              <div className={s.dividerLine} />
              {editObj.aktiv !== false ? (
                <button
                  type="button"
                  className={s.deactivateBtn}
                  onClick={() => setConfirmTarget({ id: editId, toAktiv: false })}
                >
                  🔒 Objekt deaktivieren
                </button>
              ) : (
                <button
                  type="button"
                  className={s.activateBtn}
                  onClick={() => setConfirmTarget({ id: editId, toAktiv: true })}
                >
                  🔓 Objekt aktivieren
                </button>
              )}
            </>
          )}

          <div className={s.formActions}>
            <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Abbrechen</button>
            <button type="button" className={s.saveBtn} onClick={handleSave} disabled={!form.name.trim()}>Speichern</button>
          </div>
        </div>
      )}

      <div className={s.list}>
        {filtered.length === 0 && <div className={s.emptyState}>Keine Objekte gefunden</div>}
        {filtered.map(o => {
          const isAktiv = o.aktiv !== false;
          return (
            <div key={o.id} className={`${s.objektRow} ${!isAktiv ? s.userRowInaktiv : ''}`}>
              <div className={s.objektKuerzel}>{o.kuerzel ?? '—'}</div>
              <div className={s.objektInfo}>
                <div className={s.objektName}>{o.name}</div>
                {o.adresse && <div className={s.objektAdresse}>📍 {o.adresse}</div>}
              </div>
              <div className={s.userActions}>
                <button type="button" className={s.iconBtn} onClick={() => openEdit(o)} title="Bearbeiten">✏️</button>
                {!isAktiv && <span className={s.inaktivLabel}>Inaktiv</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zweistufige Bestätigung Objekt de-/aktivieren */}
      {confirmObj && confirmTarget && (
        <ConfirmModal
          steps={
            confirmTarget.toAktiv
              ? [
                  {
                    title: 'Objekt wieder aktivieren?',
                    body: `„${confirmObj.name}" wird wieder aktiviert und steht Benutzern zur Verfügung.`,
                    confirmLabel: 'Weiter →',
                  },
                  {
                    title: 'Aktivierung bestätigen',
                    body: `Bitte bestätige, dass „${confirmObj.name}" ab sofort wieder aktiv ist.`,
                    confirmLabel: 'Ja, aktivieren',
                  },
                ]
              : [
                  {
                    title: 'Objekt deaktivieren?',
                    body: `„${confirmObj.name}" wird deaktiviert. Benutzer können keine neuen Bewirtungen für dieses Objekt erstellen.`,
                    confirmLabel: 'Weiter →',
                  },
                  {
                    title: 'Wirklich deaktivieren?',
                    body: `Bestehende Bewirtungen bleiben erhalten. Das Objekt kann später wieder aktiviert werden.`,
                    confirmLabel: 'Ja, deaktivieren',
                    danger: true,
                  },
                ]
          }
          onConfirmed={() => {
            toggleAktiv(confirmObj.id);
            setConfirmTarget(null);
            setShowForm(false);
          }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

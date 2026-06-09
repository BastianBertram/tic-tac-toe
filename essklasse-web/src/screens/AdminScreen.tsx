import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../store/userStore';
import { useObjektStore } from '../store/objektStore';
import type { UserRolle } from '../types';
import s from './AdminScreen.module.css';

type AdminTab = 'user' | 'objekte';

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

export function AdminScreen() {
  const [tab, setTab] = useState<AdminTab>('user');

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <div className={s.headerRight}>
          <span className={s.rolleChip}>Admin</span>
        </div>
      </div>

      <div className={s.tabs}>
        <button type="button" className={`${s.tab} ${tab === 'user' ? s.tabActive : ''}`} onClick={() => setTab('user')}>👤 Benutzer</button>
        <button type="button" className={`${s.tab} ${tab === 'objekte' ? s.tabActive : ''}`} onClick={() => setTab('objekte')}>🏢 Objekte</button>
      </div>

      {tab === 'user'    && <UserTab />}
      {tab === 'objekte' && <ObjekteTab />}
    </div>
  );
}

/* ─── User Tab ─── */
function UserTab() {
  const { users, addUser, updateUser, deleteUser, toggleAktiv } = useUserStore();
  const objekte = useObjektStore(st => st.objekte);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', rolle: 'user' as UserRolle, objektIds: [] as string[] });

  function openNew() {
    setForm({ name: '', email: '', rolle: 'user', objektIds: [] });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(u: typeof users[0]) {
    setForm({ name: u.name, email: u.email, rolle: u.rolle, objektIds: u.objektIds });
    setEditId(u.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (editId) {
      updateUser(editId, { name: form.name, email: form.email, rolle: form.rolle, objektIds: form.objektIds });
    } else {
      addUser(form);
    }
    setShowForm(false);
  }

  function toggleObjekt(id: string) {
    setForm(f => ({
      ...f,
      objektIds: f.objektIds.includes(id) ? f.objektIds.filter(x => x !== id) : [...f.objektIds, id],
    }));
  }

  return (
    <div className={s.tabContent}>
      <div className={s.listHeader}>
        <span className={s.listCount}>{users.length} Benutzer</span>
        <button type="button" className={s.addBtn} onClick={openNew}>+ Neuer Benutzer</button>
      </div>

      {showForm && (
        <div className={s.formCard}>
          <div className={s.formTitle}>{editId ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</div>
          <label className={s.label}>Name</label>
          <input className={s.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Vor- und Nachname" />
          <label className={s.label}>E-Mail</label>
          <input className={s.input} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="name@hwk.de" />
          <label className={s.label}>Rolle</label>
          <select className={s.select} value={form.rolle} onChange={e => setForm(f => ({...f, rolle: e.target.value as UserRolle}))}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="buchhaltung">Buchhaltung</option>
          </select>
          {form.rolle === 'user' && objekte.length > 0 && (
            <>
              <label className={s.label}>Objekte zuordnen</label>
              <div className={s.objektCheckList}>
                {objekte.map(o => (
                  <label key={o.id} className={s.checkRow}>
                    <input type="checkbox" checked={form.objektIds.includes(o.id)} onChange={() => toggleObjekt(o.id)} />
                    <span>{o.kuerzel ? `${o.kuerzel} – ` : ''}{o.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className={s.formActions}>
            <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Abbrechen</button>
            <button type="button" className={s.saveBtn} onClick={handleSave} disabled={!form.name.trim() || !form.email.trim()}>Speichern</button>
          </div>
        </div>
      )}

      <div className={s.list}>
        {users.map(u => (
          <div key={u.id} className={`${s.userRow} ${!u.aktiv ? s.userRowInaktiv : ''}`}>
            <div className={s.userAvatar} style={{ background: ROLLE_COLORS[u.rolle] }}>
              {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className={s.userInfo}>
              <div className={s.userName}>{u.name}</div>
              <div className={s.userEmail}>{u.email}</div>
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
                <button type="button" className={s.iconBtn} onClick={() => toggleAktiv(u.id)} title={u.aktiv ? 'Deaktivieren' : 'Aktivieren'}>
                  {u.aktiv ? '🔒' : '🔓'}
                </button>
                <button type="button" className={s.iconBtn} onClick={() => { if (confirm(`${u.name} wirklich löschen?`)) deleteUser(u.id); }} title="Löschen">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Objekte Tab ─── */
function ObjekteTab() {
  const { objekte, setObjekte } = useObjektStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', adresse: '', kuerzel: '' });

  function openNew() {
    setForm({ name: '', adresse: '', kuerzel: '' });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(o: typeof objekte[0]) {
    setForm({ name: o.name, adresse: o.adresse ?? '', kuerzel: o.kuerzel ?? '' });
    setEditId(o.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editId) {
      setObjekte(objekte.map(o => o.id === editId ? { ...o, ...form } : o));
    } else {
      setObjekte([...objekte, { id: uuidv4(), name: form.name, adresse: form.adresse, kuerzel: form.kuerzel }]);
    }
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (confirm('Objekt wirklich löschen?')) {
      setObjekte(objekte.filter(o => o.id !== id));
    }
  }

  return (
    <div className={s.tabContent}>
      <div className={s.listHeader}>
        <span className={s.listCount}>{objekte.length} Objekte</span>
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
          <div className={s.formActions}>
            <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Abbrechen</button>
            <button type="button" className={s.saveBtn} onClick={handleSave} disabled={!form.name.trim()}>Speichern</button>
          </div>
        </div>
      )}

      <div className={s.list}>
        {objekte.map(o => (
          <div key={o.id} className={s.objektRow}>
            <div className={s.objektKuerzel}>{o.kuerzel ?? '—'}</div>
            <div className={s.objektInfo}>
              <div className={s.objektName}>{o.name}</div>
              {o.adresse && <div className={s.objektAdresse}>📍 {o.adresse}</div>}
            </div>
            <div className={s.userActions}>
              <button type="button" className={s.iconBtn} onClick={() => openEdit(o)}>✏️</button>
              <button type="button" className={s.iconBtn} onClick={() => handleDelete(o.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

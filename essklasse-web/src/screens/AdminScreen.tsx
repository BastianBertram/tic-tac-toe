import { useState } from 'react';
import { BrandLogo, ESSKLASSE_LOGO } from '../components/BrandLogo';
import { v4 as uuidv4 } from 'uuid';
import { useUserStore } from '../store/userStore';
import { useObjektStore } from '../store/objektStore';
import { HamburgerDrawer } from '../components/HamburgerDrawer';
import type { UserRolle, Anrede } from '../types';
import { isValidEmail } from '../utils/email';
import { useSettingsStore } from '../store/settingsStore';
import { THEMES, CUSTOM_THEME_ID, isValidHex, normalizeHex, deriveMood } from '../theme';
import s from './AdminScreen.module.css';

type AdminTab = 'user' | 'objekte' | 'einstellungen';
type FilterStatus = 'aktiv' | 'inaktiv' | 'alle';

const ROLLE_LABELS: Record<UserRolle, string> = {
  user: 'User',
  admin: 'Admin',
  buchhaltung: 'Buchhaltung',
  bereichsleitung: 'Bereichsleitung',
  geschaeftsfuehrung: 'Geschäftsführung',
};

const ROLLE_COLORS: Record<UserRolle, string> = {
  user: '#2e86c1',
  admin: '#922b21',
  buchhaltung: '#1a5276',
  bereichsleitung: '#6c3483',
  geschaeftsfuehrung: '#1e6b4a',
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
            className={s.dangerBtn}
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
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>
          {tab === 'user' ? '👤 Benutzer' : tab === 'objekte' ? '🏢 Objekte' : '⚙️ Einstellungen'}
        </span>
        <div className={s.headerRight}>
          <span className={s.rolleChip}>Admin</span>
        </div>
      </div>

      {tab === 'user'          && <UserTab />}
      {tab === 'objekte'       && <ObjekteTab />}
      {tab === 'einstellungen' && <EinstellungenTab />}

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
        <button type="button" className={`${s.navTab} ${tab === 'einstellungen' ? s.navTabActive : ''}`} onClick={() => setTab('einstellungen')}>
          <span className={s.navTabIcon}>⚙️</span>
          <span className={s.navTabLabel}>Einstellungen</span>
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
  const ALLE_OBJEKTE_ID = '__alle__';
  const emptyForm = { anrede: 'Herr' as Anrede, vorname: '', nachname: '', email: '', telefon: '', rolle: 'user' as UserRolle, objektIds: [] as string[] };
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('aktiv');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmAlleObjekte, setConfirmAlleObjekte] = useState(false);
  const [confirmGeschaeftsfuehrung, setConfirmGeschaeftsfuehrung] = useState(false);

  function defaultObjektIds(rolle: UserRolle) {
    return rolle === 'buchhaltung' ? [ALLE_OBJEKTE_ID] : [];
  }
  function openNew() {
    setForm({ ...emptyForm, objektIds: defaultObjektIds('user') });
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
      objektIds: u.objektIds.length === 0 && u.rolle === 'buchhaltung' ? [ALLE_OBJEKTE_ID] : u.objektIds,
    });
    setEditId(u.id);
    setShowForm(true);
  }
  const emailTouched = form.email.length > 0;
  const emailFormatOk = isValidEmail(form.email);
  const emailError = emailTouched && !emailFormatOk
    ? 'Bitte eine gültige E-Mail-Adresse eingeben.'
    : null;
  // user/bereichsleitung/buchhaltung müssen mind. ein Objekt zugeordnet bekommen
  const needsObjekte = form.rolle === 'user' || form.rolle === 'buchhaltung' || form.rolle === 'bereichsleitung';
  const objekteOk = !needsObjekte || form.objektIds.length > 0;
  const canSave = form.vorname.trim() && form.nachname.trim() && emailFormatOk && objekteOk;
  function handleSave() {
    if (!canSave) return;
    if (form.rolle === 'geschaeftsfuehrung') {
      setConfirmGeschaeftsfuehrung(true);
      return;
    }
    if (form.rolle === 'buchhaltung' && form.objektIds.includes(ALLE_OBJEKTE_ID)) {
      setConfirmAlleObjekte(true);
      return;
    }
    doSave();
  }
  function doSave() {
    const objektIds = form.objektIds.filter(id => id !== ALLE_OBJEKTE_ID);
    if (editId) updateUser(editId, { anrede: form.anrede, vorname: form.vorname, nachname: form.nachname, email: form.email, telefon: form.telefon, rolle: form.rolle, objektIds });
    else        addUser({ ...form, objektIds });
    setShowForm(false);
    setConfirmAlleObjekte(false);
    setConfirmGeschaeftsfuehrung(false);
  }
  function toggleObjekt(id: string) {
    setForm(f => ({
      ...f,
      // Einzelnes Objekt anklicken → "Alle Objekte" wird automatisch entfernt
      objektIds: f.objektIds.includes(id)
        ? f.objektIds.filter(x => x !== id)
        : [...f.objektIds.filter(x => x !== ALLE_OBJEKTE_ID), id],
    }));
  }
  function toggleAlleObjekte() {
    setForm(f => ({
      ...f,
      objektIds: f.objektIds.includes(ALLE_OBJEKTE_ID) ? [] : [ALLE_OBJEKTE_ID],
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
          <input
            className={`${s.input} ${emailError ? s.inputError : emailTouched && emailFormatOk ? s.inputOk : ''}`}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({...f, email: e.target.value}))}
            placeholder="name@hwk.de"
          />
          {emailError && <div className={s.fieldError}>{emailError}</div>}

          <label className={s.label}>Telefonnummer</label>
          <input className={s.input} type="tel" value={form.telefon} onChange={e => setForm(f => ({...f, telefon: e.target.value}))} placeholder="+49 511 123456" />

          <label className={s.label}>Rolle *</label>
          <select className={s.select} value={form.rolle} onChange={e => {
            const rolle = e.target.value as UserRolle;
            setForm(f => ({ ...f, rolle, objektIds: defaultObjektIds(rolle) }));
          }}>
            <option value="user">User</option>
            <option value="bereichsleitung">Bereichsleitung</option>
            <option value="buchhaltung">Buchhaltung</option>
            <option value="geschaeftsfuehrung">Geschäftsführung</option>
            <option value="admin">Admin</option>
          </select>

          {(form.rolle === 'user' || form.rolle === 'buchhaltung' || form.rolle === 'bereichsleitung') && objekte.length > 0 && (
            <>
              <label className={s.label}>Objekte zuordnen *</label>
              <div className={s.objektCheckList}>
                {form.rolle === 'buchhaltung' && (
                  <label className={`${s.checkRow} ${s.checkRowAlle}`}>
                    <input
                      type="checkbox"
                      checked={form.objektIds.includes(ALLE_OBJEKTE_ID)}
                      onChange={toggleAlleObjekte}
                    />
                    <span className={s.checkRowAlleLabel}>🌐 Alle Objekte</span>
                  </label>
                )}
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
              <div className={s.userName}>{u.name}</div>
              <div className={s.userEmail}>{u.email}</div>
              {u.telefon && <div className={s.userEmail}>{u.telefon}</div>}
              {(u.rolle === 'user' || u.rolle === 'bereichsleitung') && u.objektIds.length > 0 && (
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

      {/* Warnung: Buchhaltung mit allen Objekten speichern */}
      {confirmAlleObjekte && (
        <ConfirmModal
          steps={[
            {
              title: '⚠️ Zugriff auf alle Objekte',
              body: `Diese Buchhaltungs-Rolle erhält Zugriff auf alle Objekte — auch auf solche, die in Zukunft hinzugefügt werden. Bitte prüfe, ob das beabsichtigt ist.`,
              confirmLabel: 'Verstanden, weiter →',
              danger: true,
            },
            {
              title: 'Zugriff auf alle Objekte bestätigen',
              body: `Der Benutzer ${form.vorname} ${form.nachname} erhält uneingeschränkten Zugriff auf alle Objekte und Bewirtungen.`,
              confirmLabel: 'Ja, so speichern',
              danger: true,
            },
          ]}
          onConfirmed={doSave}
          onCancel={() => setConfirmAlleObjekte(false)}
        />
      )}

      {/* Warnung: Geschäftsführung vergeben */}
      {confirmGeschaeftsfuehrung && (
        <ConfirmModal
          steps={[
            {
              title: '⚠️ Erweiterte Rolle vergeben',
              body: `Die Rolle „Geschäftsführung" ermöglicht den Wechsel in alle anderen Rollen der App — einschließlich Admin. Bitte stelle sicher, dass dies beabsichtigt ist.`,
              confirmLabel: 'Verstanden, weiter →',
              danger: true,
            },
            {
              title: 'Geschäftsführungs-Rolle bestätigen',
              body: `${form.vorname} ${form.nachname} erhält die Rolle „Geschäftsführung" und damit vollen Rollenzugriff auf die gesamte App.`,
              confirmLabel: 'Ja, so speichern',
              danger: true,
            },
          ]}
          onConfirmed={doSave}
          onCancel={() => setConfirmGeschaeftsfuehrung(false)}
        />
      )}

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
  const emptyObjForm = { name: '', kuerzel: '', strasse: '', plz: '', ort: '', telefon: '', email: '', kostenstellen: [''] };
  const [form, setForm] = useState(emptyObjForm);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('aktiv');
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; toAktiv: boolean } | null>(null);

  function openNew() { setForm(emptyObjForm); setEditId(null); setShowForm(true); }
  function openEdit(o: typeof objekte[0]) {
    setForm({
      name: o.name,
      kuerzel: o.kuerzel ?? '',
      strasse: o.strasse ?? '',
      plz: o.plz ?? '',
      ort: o.ort ?? '',
      telefon: o.telefon ?? '',
      email: o.email ?? '',
      kostenstellen: o.kostenstellen?.length ? o.kostenstellen : [''],
    });
    setEditId(o.id);
    setShowForm(true);
  }

  const objEmailTouched = form.email.length > 0;
  const objEmailOk = !objEmailTouched || isValidEmail(form.email);
  const objEmailError = objEmailTouched && !objEmailOk ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : null;
  const canSaveObjekt = form.name.trim() && form.kuerzel.trim() && form.strasse.trim() && form.plz.trim() && form.ort.trim() && objEmailOk;

  function handleSave() {
    if (!canSaveObjekt) return;
    const kostenstellen = form.kostenstellen.filter(k => k.trim());
    const data = { name: form.name, kuerzel: form.kuerzel, strasse: form.strasse, plz: form.plz, ort: form.ort, telefon: form.telefon, email: form.email, kostenstellen };
    if (editId) updateObjekt(editId, data);
    else setObjekte([...objekte, { id: uuidv4(), ...data, aktiv: true }]);
    setShowForm(false);
  }

  function setKostenstelle(idx: number, val: string) {
    setForm(f => { const ks = [...f.kostenstellen]; ks[idx] = val; return { ...f, kostenstellen: ks }; });
  }
  function addKostenstelle() {
    setForm(f => ({ ...f, kostenstellen: [...f.kostenstellen, ''] }));
  }
  function removeKostenstelle(idx: number) {
    setForm(f => ({ ...f, kostenstellen: f.kostenstellen.filter((_, i) => i !== idx) }));
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

          <label className={s.label}>Objektname *</label>
          <input className={s.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="HWK Hannover Hauptgebäude" />

          <label className={s.label}>Objektkürzel *</label>
          <input className={s.input} value={form.kuerzel} onChange={e => setForm(f => ({...f, kuerzel: e.target.value}))} placeholder="z.B. HWK oder FBZ" />

          <label className={s.label}>Straße und Hausnummer *</label>
          <input className={s.input} value={form.strasse} onChange={e => setForm(f => ({...f, strasse: e.target.value}))} placeholder="Berliner Allee 17" />

          <div className={s.twoCol}>
            <div>
              <label className={s.label}>PLZ *</label>
              <input className={s.input} value={form.plz} onChange={e => setForm(f => ({...f, plz: e.target.value}))} placeholder="30175" maxLength={5} />
            </div>
            <div style={{ flex: 2 }}>
              <label className={s.label}>Ort *</label>
              <input className={s.input} value={form.ort} onChange={e => setForm(f => ({...f, ort: e.target.value}))} placeholder="Hannover" />
            </div>
          </div>

          <label className={s.label}>Telefonnummer</label>
          <input className={s.input} type="tel" value={form.telefon} onChange={e => setForm(f => ({...f, telefon: e.target.value}))} placeholder="0511 123456" />

          <label className={s.label}>E-Mail</label>
          <input
            className={`${s.input} ${objEmailError ? s.inputError : objEmailTouched && objEmailOk ? s.inputOk : ''}`}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({...f, email: e.target.value}))}
            placeholder="info@objekt.de"
          />
          {objEmailError && <div className={s.fieldError}>{objEmailError}</div>}

          <label className={s.label}>Kostenstellen</label>
          <div className={s.kostenstellenList}>
            {form.kostenstellen.map((k, idx) => (
              <div key={idx} className={s.kostenstelleRow}>
                <input
                  className={s.input}
                  value={k}
                  onChange={e => setKostenstelle(idx, e.target.value)}
                  placeholder={`Kostenstelle ${idx + 1}`}
                />
                {form.kostenstellen.length > 1 && (
                  <button type="button" className={s.ksRemoveBtn} onClick={() => removeKostenstelle(idx)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className={s.ksAddBtn} onClick={addKostenstelle}>+ Kostenstelle hinzufügen</button>
          </div>

          {/* De-/Aktivieren — nur bei bestehenden Objekten */}
          {editId && editObj && (
            <>
              <div className={s.dividerLine} />
              {editObj.aktiv !== false ? (
                <button type="button" className={s.deactivateBtn} onClick={() => setConfirmTarget({ id: editId, toAktiv: false })}>
                  🔒 Objekt deaktivieren
                </button>
              ) : (
                <button type="button" className={s.activateBtn} onClick={() => setConfirmTarget({ id: editId, toAktiv: true })}>
                  🔓 Objekt aktivieren
                </button>
              )}
            </>
          )}

          <div className={s.formActions}>
            <button type="button" className={s.cancelBtn} onClick={() => setShowForm(false)}>Abbrechen</button>
            <button type="button" className={s.saveBtn} onClick={handleSave} disabled={!canSaveObjekt}>Speichern</button>
          </div>
        </div>
      )}

      <div className={s.list}>
        {filtered.length === 0 && <div className={s.emptyState}>Keine Objekte gefunden</div>}
        {filtered.map(o => {
          const isAktiv = o.aktiv !== false;
          const adresse = [o.strasse, o.plz && o.ort ? `${o.plz} ${o.ort}` : ''].filter(Boolean).join(', ') || o.adresse;
          return (
            <div key={o.id} className={`${s.objektRow} ${!isAktiv ? s.userRowInaktiv : ''}`}>
              <div className={s.objektKuerzel}>{o.kuerzel || '—'}</div>
              <div className={s.objektInfo}>
                <div className={s.objektName}>{o.name}</div>
                {adresse && <div className={s.objektAdresse}>📍 {adresse}</div>}
                {o.kostenstellen?.length > 0 && (
                  <div className={s.userObjekte}>
                    {o.kostenstellen.map(k => <span key={k} className={s.objektTag}>{k}</span>)}
                  </div>
                )}
              </div>
              <div className={s.userActions}>
                <button type="button" className={s.iconBtn} onClick={() => openEdit(o)} title="Bearbeiten">✏️</button>
                {!isAktiv && <span className={s.inaktivLabel}>Inaktiv</span>}
              </div>
            </div>
          );
        })}
      </div>

      {confirmObj && confirmTarget && (
        <ConfirmModal
          steps={
            confirmTarget.toAktiv
              ? [
                  { title: 'Objekt wieder aktivieren?', body: `„${confirmObj.name}" wird wieder aktiviert und steht Benutzern zur Verfügung.`, confirmLabel: 'Weiter →' },
                  { title: 'Aktivierung bestätigen', body: `Bitte bestätige, dass „${confirmObj.name}" ab sofort wieder aktiv ist.`, confirmLabel: 'Ja, aktivieren' },
                ]
              : [
                  { title: 'Objekt deaktivieren?', body: `„${confirmObj.name}" wird deaktiviert. Benutzer können keine neuen Bewirtungen für dieses Objekt erstellen.`, confirmLabel: 'Weiter →' },
                  { title: 'Wirklich deaktivieren?', body: `Bestehende Bewirtungen bleiben erhalten. Das Objekt kann später wieder aktiviert werden.`, confirmLabel: 'Ja, deaktivieren' },
                ]
          }
          onConfirmed={() => { toggleAktiv(confirmObj.id); setConfirmTarget(null); setShowForm(false); }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

/* ─── Einstellungen Tab ─── */
const MAX_LOGO_BYTES = 800 * 1024; // ~800 KB Schutz für localStorage

function EinstellungenTab() {
  const { themeId, setTheme, customColor, setCustomColor, logoDataUrl, setLogo } = useSettingsStore();
  const [logoError, setLogoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const istEssKlasse = logoDataUrl === ESSKLASSE_LOGO;

  // Vorab gewählte (noch nicht übernommene) Farbe
  const [selThemeId, setSelThemeId] = useState(themeId);
  const [hexInput, setHexInput] = useState(customColor ?? '#3366cc');
  const hexValid = isValidHex(hexInput);
  const customSwatch = hexValid ? deriveMood(hexInput) : null;
  const selCustom = selThemeId === CUSTOM_THEME_ID;
  const canApply = selCustom ? hexValid : true;

  function chooseHex(hex: string) {
    setHexInput(hex);
    setSelThemeId(CUSTOM_THEME_ID);
  }
  function applySelection() {
    if (selCustom) {
      if (hexValid) setCustomColor(normalizeHex(hexInput));
    } else {
      setTheme(selThemeId);
    }
  }

  function handleLogoFile(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Bitte eine Bilddatei auswählen (PNG, JPG, WEBP oder SVG).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Die Datei ist zu groß (max. 800 KB). Bitte ein kleineres Bild verwenden.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setLogoError('Die Datei konnte nicht gelesen werden.');
    reader.readAsDataURL(file);
  }

  return (
    <div className={s.tabContent}>
      {/* Unternehmenslogo */}
      <div className={s.formCard}>
        <div className={s.formTitle}>Unternehmenslogo</div>
        <p className={s.settingsHint}>
          Wird in der Kopfzeile und in allen Bereichen der App angezeigt.
          Standard ist <strong>kein Logo</strong>. Empfohlen: PNG/SVG mit transparentem
          Hintergrund, max. 800 KB.
        </p>

        <div className={s.logoPreviewBox}>
          {logoDataUrl
            ? <BrandLogo className={s.logoPreview} />
            : <span className={s.logoEmpty}>Kein Logo</span>}
        </div>

        {logoError && <div className={s.fieldError}>{logoError}</div>}

        <div className={s.settingsBtnRow}>
          <label className={s.uploadBtn}>
            {logoDataUrl && !istEssKlasse ? '🖼 Logo ersetzen' : '⬆️ Logo hochladen'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={e => { handleLogoFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
          {!istEssKlasse && (
            <button type="button" className={s.resetBtn} onClick={() => { setLogoError(null); setLogo(ESSKLASSE_LOGO); }}>
              🍅 EssKlasse-Logo
            </button>
          )}
          {logoDataUrl && (
            <button type="button" className={s.deleteBtn} onClick={() => setConfirmDelete(true)}>
              🗑 Logo löschen
            </button>
          )}
        </div>
      </div>

      {/* App-Farbe / Mood */}
      <div className={s.formCard}>
        <div className={s.formTitle}>App-Farbe (Mood)</div>
        <p className={s.settingsHint}>
          Bestimmt die Akzent- und Markenfarbe der gesamten App. Farbe auswählen und
          mit „Übernehmen" aktivieren.
        </p>

        <div className={s.moodGrid}>
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`${s.moodCard} ${selThemeId === t.id ? s.moodCardActive : ''}`}
              onClick={() => setSelThemeId(t.id)}
            >
              <span className={s.moodSwatch} style={{ background: t.primary }}>
                <span className={s.moodSwatchSoft} style={{ background: t.soft }} />
                {selThemeId === t.id && <span className={s.moodCheck}>✓</span>}
              </span>
              <span className={s.moodName}>{t.name}</span>
            </button>
          ))}

          {/* Eigene Farbe – Swatch */}
          <button
            type="button"
            className={`${s.moodCard} ${selCustom ? s.moodCardActive : ''}`}
            onClick={() => setSelThemeId(CUSTOM_THEME_ID)}
          >
            <span
              className={s.moodSwatch}
              style={customSwatch
                ? { background: customSwatch.primary }
                : { background: 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' }}
            >
              {customSwatch && <span className={s.moodSwatchSoft} style={{ background: customSwatch.soft }} />}
              {selCustom ? <span className={s.moodCheck}>✓</span> : <span className={s.moodPlus}>+</span>}
            </span>
            <span className={s.moodName}>Eigene Farbe</span>
          </button>
        </div>

        {/* Eigener Farbcode */}
        <div className={s.hexRow}>
          <input
            type="color"
            className={s.colorPicker}
            value={hexValid ? normalizeHex(hexInput) : '#3366cc'}
            onChange={e => chooseHex(e.target.value)}
            aria-label="Farbe wählen"
          />
          <input
            className={`${s.input} ${s.hexInput} ${hexInput && !hexValid ? s.inputError : ''}`}
            value={hexInput}
            onChange={e => chooseHex(e.target.value)}
            placeholder="#RRGGBB"
            spellCheck={false}
          />
        </div>
        {selCustom && hexInput && !hexValid && (
          <div className={s.fieldError}>Bitte einen gültigen Hex-Code eingeben (z.B. #2e7d32).</div>
        )}

        <button
          type="button"
          className={s.applyBtn}
          disabled={!canApply}
          onClick={applySelection}
        >
          Übernehmen
        </button>
      </div>

      {confirmDelete && (
        <ConfirmModal
          steps={[
            { title: 'Logo löschen?', body: 'Das aktuelle Logo wird entfernt. Die App zeigt anschließend kein Logo mehr an.', confirmLabel: 'Weiter →' },
            { title: 'Wirklich löschen?', body: 'Ein hochgeladenes Logo geht dabei verloren und müsste erneut hochgeladen werden.', confirmLabel: 'Ja, löschen', danger: true },
          ]}
          onConfirmed={() => { setLogo(null); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useUserStore } from '../store/userStore';
import { HamburgerDrawer } from '../components/HamburgerDrawer';
import type { Bewirtungsbeleg, UserRolle } from '../types';
import bs from './BuchhaltungScreen.module.css';   // reuse Buchhaltung styles
import s from './AdminScreen.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminTab = 'alle' | 'ueberfaellig' | 'bereit' | 'erledigt' | 'benutzer' | 'objekte';
type SortOpt  = 'datum' | 'bestellnr' | 'bestellnr-desc' | 'rechnungsnr' | 'rechnungsnr-desc';
type StatusFilter = 'offen' | 'abgeschlossen' | 'rechnung' | 'geloescht';
type StatusFilterOpt = 'alle' | StatusFilter;

interface TabControls { search: string; objekt: string; sort: SortOpt; }
interface AlleControls { search: string; statusFilter: StatusFilterOpt; }

const INIT_CONTROLS: TabControls = { search: '', objekt: 'alle', sort: 'datum' };
const INIT_ALLE: AlleControls    = { search: '', statusFilter: 'alle' };

interface Props {
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
  onRechnungErstellen: (b: Bewirtungsbeleg) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function byBestellungsnr(a: Bewirtungsbeleg, b: Bewirtungsbeleg) {
  return (a.bestellungsnummer ?? '').localeCompare(b.bestellungsnummer ?? '');
}
function byRechnungsnr(a: Bewirtungsbeleg, b: Bewirtungsbeleg) {
  return (a.rechnungsnummer ?? '').localeCompare(b.rechnungsnummer ?? '');
}
function byDatumUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg) {
  return `${a.cateringDatumVon}T${a.uhrzeitVon ?? '00:00'}`.localeCompare(
         `${b.cateringDatumVon}T${b.uhrzeitVon ?? '00:00'}`);
}

function textMatch(
  b: Bewirtungsbeleg,
  q: string,
  objekte: ReturnType<typeof useObjektStore.getState>['objekte']
) {
  const datum = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy');
  const obj   = objekte.find(o => o.id === b.objektId);
  return (
    datum.includes(q) ||
    (b.bestellungsnummer ?? '').toLowerCase().includes(q) ||
    (b.rechnungsnummer  ?? '').toLowerCase().includes(q) ||
    (b.veranstaltung    ?? '').toLowerCase().includes(q) ||
    (b.besteller        ?? '').toLowerCase().includes(q) ||
    (obj?.name          ?? '').toLowerCase().includes(q) ||
    (obj?.kuerzel       ?? '').toLowerCase().includes(q)
  );
}

function applyControls(
  list: Bewirtungsbeleg[],
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'],
  opts: TabControls
): Bewirtungsbeleg[] {
  let out = [...list];
  if (opts.objekt !== 'alle') out = out.filter(b => b.objektId === opts.objekt);
  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(b => textMatch(b, q, objekte));
  }
  if      (opts.sort === 'datum')         out.sort(byDatumUhrzeit);
  else if (opts.sort === 'bestellnr-desc') out.sort((a, b) => byBestellungsnr(b, a));
  else if (opts.sort === 'rechnungsnr')    out.sort(byRechnungsnr);
  else if (opts.sort === 'rechnungsnr-desc') out.sort((a, b) => byRechnungsnr(b, a));
  else                                    out.sort(byBestellungsnr);
  return out;
}

function applyAlleControls(
  list: Bewirtungsbeleg[],
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'],
  opts: AlleControls
): Bewirtungsbeleg[] {
  let out = [...list];
  if (opts.statusFilter !== 'alle') {
    out = out.filter(b => {
      const f = opts.statusFilter;
      if (f === 'geloescht')      return b.deleted;
      if (f === 'rechnung')       return !b.deleted && b.rechnungErstellt;
      if (f === 'abgeschlossen')  return !b.deleted && b.abgeschlossen && !b.rechnungErstellt;
      if (f === 'offen')          return !b.deleted && !b.abgeschlossen;
      return true;
    });
  }
  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(b => textMatch(b, q, objekte));
  }
  out.sort(byBestellungsnr);
  return out;
}

const STATUS_FILTER_CONFIG: { id: StatusFilterOpt; label: string; activeClass: string }[] = [
  { id: 'alle',          label: 'Alle',           activeClass: 'filterChipActiveAlle' },
  { id: 'offen',         label: 'Offen',          activeClass: 'filterChipActiveOffen' },
  { id: 'abgeschlossen', label: 'Abgeschlossen',  activeClass: 'filterChipActiveAbgeschlossen' },
  { id: 'rechnung',      label: '✅ Rechnung',    activeClass: 'filterChipActiveRechnung' },
  { id: 'geloescht',     label: 'Gelöscht',       activeClass: 'filterChipActiveGeloescht' },
];

const ROLLE_LABELS: Record<UserRolle, string> = { user: 'User', admin: 'Admin', buchhaltung: 'Buchhaltung' };
const ROLLE_COLORS: Record<UserRolle, string> = { user: '#2e86c1', admin: '#922b21', buchhaltung: '#1a5276' };

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AdminScreen({ onOpenBeleg, onRechnungErstellen }: Props) {
  const belege  = useBelegStore(st => st.belege);
  const objekte = useObjektStore(st => st.objekte);

  const [tab,         setTab]         = useState<AdminTab>('alle');
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  const [ctrlAlle,   setCtrlAlle]   = useState<AlleControls>(INIT_ALLE);
  const [ctrlUeber,  setCtrlUeber]  = useState<TabControls>(INIT_CONTROLS);
  const [ctrlBereit, setCtrlBereit] = useState<TabControls>(INIT_CONTROLS);
  const [ctrlErl,    setCtrlErl]    = useState<TabControls>(INIT_CONTROLS);

  const now     = new Date();
  const nowDate = format(now, 'yyyy-MM-dd');
  const nowTime = format(now, 'HH:mm');

  const alleBase = useMemo(() => [...belege].sort(byBestellungsnr), [belege]);

  const ueberfaelligBase = useMemo(() =>
    belege.filter(b => {
      if (b.deleted || b.abgeschlossen) return false;
      if (b.cateringDatumVon < nowDate) return true;
      if (b.cateringDatumVon === nowDate && b.uhrzeitBis && b.uhrzeitBis < nowTime) return true;
      return false;
    }), [belege, nowDate, nowTime]);

  const bereitBase   = useMemo(() =>
    belege.filter(b => !b.deleted && b.abgeschlossen && !b.rechnungErstellt), [belege]);

  const erledigtBase = useMemo(() =>
    belege.filter(b => !b.deleted && b.rechnungErstellt), [belege]);

  const alleBelege         = useMemo(() => applyAlleControls(alleBase,        objekte, ctrlAlle),   [alleBase,         objekte, ctrlAlle]);
  const ueberfaelligBelege = useMemo(() => applyControls(ueberfaelligBase,    objekte, ctrlUeber),  [ueberfaelligBase, objekte, ctrlUeber]);
  const bereitBelege       = useMemo(() => applyControls(bereitBase,          objekte, ctrlBereit), [bereitBase,       objekte, ctrlBereit]);
  const erledigtBelege     = useMemo(() => applyControls(erledigtBase,        objekte, ctrlErl),    [erledigtBase,     objekte, ctrlErl]);

  const BELEG_TABS = [
    { id: 'alle'          as AdminTab, label: 'Alle\nBewirtungen',       count: alleBase.length,         urgent: false },
    { id: 'ueberfaellig'  as AdminTab, label: 'Bewirtungen\nüberfällig', count: ueberfaelligBase.length, urgent: true  },
    { id: 'bereit'        as AdminTab, label: 'Bereit für\nRechnung',    count: bereitBase.length,       urgent: false },
    { id: 'erledigt'      as AdminTab, label: 'Rechnung\nerstellt',      count: erledigtBase.length,     urgent: false },
  ];

  const displayList =
    tab === 'alle'         ? alleBelege :
    tab === 'ueberfaellig' ? ueberfaelligBelege :
    tab === 'bereit'       ? bereitBelege :
    tab === 'erledigt'     ? erledigtBelege : [];

  const ctrl    = tab === 'ueberfaellig' ? ctrlUeber : tab === 'bereit' ? ctrlBereit : ctrlErl;
  const setCtrl = tab === 'ueberfaellig' ? setCtrlUeber : tab === 'bereit' ? setCtrlBereit : setCtrlErl;

  const isBelegTab = tab === 'alle' || tab === 'ueberfaellig' || tab === 'bereit' || tab === 'erledigt';

  return (
    <div className={bs.screen}>
      {/* Header */}
      <div className={bs.header}>
        <img src="/logo.webp" alt="EssKlasse" className={bs.logo} />
        <span className={s.rolleChip}>Admin</span>
      </div>

      {/* Content */}
      {isBelegTab && (
        <div className={bs.content}>
          {/* Alle: Suche + Status-Filter */}
          {tab === 'alle' && (
            <div className={bs.filters}>
              <input
                className={bs.searchInput} type="search"
                placeholder="🔍 Datum, Bestellnr., Veranstaltung, Besteller, Objekt…"
                value={ctrlAlle.search}
                onChange={e => setCtrlAlle(c => ({ ...c, search: e.target.value }))}
              />
              <div className={bs.filterChipsRow}>
                {STATUS_FILTER_CONFIG.map(f => (
                  <button key={f.id} type="button"
                    className={`${bs.filterChip} ${ctrlAlle.statusFilter === f.id ? bs[f.activeClass] : ''}`}
                    onClick={() => setCtrlAlle(c => ({ ...c, statusFilter: f.id }))}
                  >{f.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Überfällig / Bereit / Erledigt: Suche + Objekt + Sort */}
          {tab !== 'alle' && (
            <div className={bs.filters}>
              <input
                className={bs.searchInput} type="search"
                placeholder="🔍 Datum, Bestellnr., Veranstaltung, Besteller, Objekt…"
                value={ctrl.search}
                onChange={e => setCtrl(c => ({ ...c, search: e.target.value }))}
              />
              <select className={bs.select} value={ctrl.objekt}
                onChange={e => setCtrl(c => ({ ...c, objekt: e.target.value }))}>
                <option value="alle">Alle Objekte</option>
                {objekte.map(o => (
                  <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ${o.name}` : o.name}</option>
                ))}
              </select>
              <div className={bs.sortRow}>
                <span className={bs.sortLabel}>Sortierung:</span>
                {(['datum','bestellnr'] as SortOpt[]).map(opt => (
                  <button key={opt} type="button"
                    className={`${bs.sortBtn} ${ctrl.sort === opt ? bs.sortBtnActive : ''}`}
                    onClick={() => setCtrl(c => ({ ...c, sort: opt }))}>
                    {opt === 'datum' ? '📅 Bewirtungsdatum' : '# Bestellnr. ↑'}
                  </button>
                ))}
                {tab === 'erledigt' && (['bestellnr-desc','rechnungsnr','rechnungsnr-desc'] as SortOpt[]).map(opt => (
                  <button key={opt} type="button"
                    className={`${bs.sortBtn} ${ctrl.sort === opt ? bs.sortBtnActive : ''}`}
                    onClick={() => setCtrl(c => ({ ...c, sort: opt }))}>
                    {opt === 'bestellnr-desc' ? '# Bestellnr. ↓' : opt === 'rechnungsnr' ? '🧾 Rechnungsnr. ↑' : '🧾 Rechnungsnr. ↓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={bs.list}>
            {displayList.length === 0 ? (
              <div className={bs.empty}>
                <div className={bs.emptyIcon}>
                  {tab === 'ueberfaellig' ? '✅' : tab === 'erledigt' ? '🎉' : '📋'}
                </div>
                <p>
                  {tab === 'ueberfaellig' ? 'Keine überfälligen Bewirtungen.' :
                   tab === 'erledigt'     ? 'Noch keine Rechnungen erstellt.' :
                   tab === 'bereit'       ? 'Keine Bewirtungen zur Rechnungsstellung.' :
                                            'Keine Bewirtungen vorhanden.'}
                </p>
              </div>
            ) : (
              displayList.map(b => (
                <BelegeRow
                  key={b.id}
                  beleg={b}
                  objekte={objekte}
                  onOpen={() => onOpenBeleg(b)}
                  showRechnungBtn={tab === 'bereit' && !b.deleted}
                  onMarkRechnung={() => onRechnungErstellen(b)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'benutzer' && <UserTab />}
      {tab === 'objekte'  && <ObjekteTab />}

      {/* Bottom Nav */}
      <nav className={bs.nav}>
        <button type="button" className={bs.hamburgerBtn} onClick={() => setDrawerOpen(true)}>
          <span className={bs.hamburger}><span /><span /><span /></span>
          <span className={bs.navLabel}>Menü</span>
        </button>
        {BELEG_TABS.map(t => (
          <button key={t.id} type="button"
            className={`${bs.navTab} ${tab === t.id ? bs.navTabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={bs.navLabel} style={{ whiteSpace: 'pre-line', fontSize: 10 }}>{t.label}</span>
            {t.count > 0 && (
              <span className={`${bs.badge} ${t.urgent ? bs.badgeUrgent : ''}`}>{t.count}</span>
            )}
          </button>
        ))}
        <button type="button"
          className={`${bs.navTab} ${tab === 'benutzer' ? bs.navTabActive : ''}`}
          onClick={() => setTab('benutzer')}
        >
          <span className={bs.navLabel} style={{ fontSize: 10 }}>👤{'\n'}Benutzer</span>
        </button>
        <button type="button"
          className={`${bs.navTab} ${tab === 'objekte' ? bs.navTabActive : ''}`}
          onClick={() => setTab('objekte')}
        >
          <span className={bs.navLabel} style={{ fontSize: 10 }}>🏢{'\n'}Objekte</span>
        </button>
      </nav>

      {drawerOpen && (
        <HamburgerDrawer onClose={() => setDrawerOpen(false)} onAbgeschlossene={() => {}} />
      )}
    </div>
  );
}

// ─── BelegeRow (same as BuchhaltungScreen) ────────────────────────────────────
function BelegeRow({ beleg: b, objekte, onOpen, showRechnungBtn, onMarkRechnung }: {
  beleg: Bewirtungsbeleg;
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'];
  onOpen: () => void;
  showRechnungBtn: boolean;
  onMarkRechnung: () => void;
}) {
  const datum  = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
  const objekt = objekte.find(o => o.id === b.objektId);

  return (
    <div className={`${bs.row} ${b.deleted ? bs.rowDeleted : b.rechnungErstellt ? bs.rowErledigt : !b.abgeschlossen ? bs.rowOffen : ''}`}>
      <div className={bs.rowMain} onClick={onOpen}>
        <div className={bs.rowTop}>
          <span className={bs.rowNr}>{b.bestellungsnummer ?? '–'}</span>
          {b.rechnungsnummer && <span className={bs.rowRechnungNr}>🧾 {b.rechnungsnummer}</span>}
          {b.deleted
            ? <span className={bs.chipDeleted}>Bewirtung gelöscht</span>
            : b.abgeschlossen
              ? <span className={bs.chipDone}>Abgeschlossen</span>
              : <span className={bs.chipOffen}>Offen</span>}
          {b.rechnungErstellt && <span className={bs.chipRechnung}>✅ Rechnung</span>}
        </div>
        <div className={bs.rowTitle}>{b.veranstaltung || 'Bewirtung'}</div>
        <div className={bs.rowMeta}>
          <span>📅 {datum}</span>
          {b.uhrzeitVon && <span>🕐 {b.uhrzeitVon}–{b.uhrzeitBis}</span>}
          <span>👥 {b.personenzahl} Pers.</span>
          {objekt && <span>🏢 {objekt.kuerzel ?? objekt.name}</span>}
          <span>{b.besteller}</span>
        </div>
      </div>
      {showRechnungBtn && (
        <button type="button"
          className={`${bs.rechnungBtn} ${b.rechnungErstellt ? bs.rechnungBtnDone : ''}`}
          onClick={onMarkRechnung}
        >
          {b.rechnungErstellt ? '✅ Rechnung erstellt' : '☐ Rechnung erstellen'}
        </button>
      )}
    </div>
  );
}

// ─── UserTab ──────────────────────────────────────────────────────────────────
function UserTab() {
  const { users, addUser, updateUser, deleteUser, toggleAktiv } = useUserStore();
  const objekte = useObjektStore(st => st.objekte);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
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
    if (editId) updateUser(editId, { name: form.name, email: form.email, rolle: form.rolle, objektIds: form.objektIds });
    else        addUser(form);
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

// ─── ObjekteTab ───────────────────────────────────────────────────────────────
function ObjekteTab() {
  const { objekte, setObjekte } = useObjektStore();
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', adresse: '', kuerzel: '' });

  function openNew() { setForm({ name: '', adresse: '', kuerzel: '' }); setEditId(null); setShowForm(true); }
  function openEdit(o: typeof objekte[0]) {
    setForm({ name: o.name, adresse: o.adresse ?? '', kuerzel: o.kuerzel ?? '' });
    setEditId(o.id);
    setShowForm(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editId) setObjekte(objekte.map(o => o.id === editId ? { ...o, ...form } : o));
    else        setObjekte([...objekte, { id: uuidv4(), name: form.name, adresse: form.adresse, kuerzel: form.kuerzel }]);
    setShowForm(false);
  }
  function handleDelete(id: string) {
    if (confirm('Objekt wirklich löschen?')) setObjekte(objekte.filter(o => o.id !== id));
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

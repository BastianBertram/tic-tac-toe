import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { HamburgerDrawer } from '../components/HamburgerDrawer';
import type { Bewirtungsbeleg } from '../types';
import s from './BuchhaltungScreen.module.css';

type BuchTab = 'alle' | 'ueberfaellig' | 'bereit' | 'erledigt';
type SortOpt = 'datum' | 'bestellnr' | 'bestellnr-desc' | 'rechnungsnr' | 'rechnungsnr-desc';
type StatusFilter = 'offen' | 'abgeschlossen' | 'rechnung' | 'geloescht';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; onRechnungErstellen: (b: Bewirtungsbeleg) => void; }

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

function textMatch(b: Bewirtungsbeleg, q: string, objekte: ReturnType<typeof useObjektStore.getState>['objekte']) {
  const datum = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy');
  const obj = objekte.find(o => o.id === b.objektId);
  return (
    datum.includes(q) ||
    (b.bestellungsnummer ?? '').toLowerCase().includes(q) ||
    (b.rechnungsnummer ?? '').toLowerCase().includes(q) ||
    (b.veranstaltung ?? '').toLowerCase().includes(q) ||
    (b.besteller ?? '').toLowerCase().includes(q) ||
    (obj?.name ?? '').toLowerCase().includes(q) ||
    (obj?.kuerzel ?? '').toLowerCase().includes(q)
  );
}

/** Filter/Such/Sortier-Logik für Überfällig / Bereit / Erledigt */
function applyControls(
  list: Bewirtungsbeleg[],
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'],
  opts: { search: string; objekt: string; sort: SortOpt }
): Bewirtungsbeleg[] {
  let out = [...list];
  if (opts.objekt !== 'alle') out = out.filter(b => b.objektId === opts.objekt);
  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(b => textMatch(b, q, objekte));
  }
  if (opts.sort === 'datum') out.sort(byDatumUhrzeit);
  else if (opts.sort === 'bestellnr-desc') out.sort((a, b) => byBestellungsnr(b, a));
  else if (opts.sort === 'rechnungsnr') out.sort(byRechnungsnr);
  else if (opts.sort === 'rechnungsnr-desc') out.sort((a, b) => byRechnungsnr(b, a));
  else out.sort(byBestellungsnr);
  return out;
}

/** Filter/Such-Logik für Alle Bewirtungen */
function applyAlleControls(
  list: Bewirtungsbeleg[],
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'],
  opts: { search: string; statusFilter: StatusFilter[] }
): Bewirtungsbeleg[] {
  let out = [...list];

  // Status-Filter (OR-Logik: keiner aktiv = alle zeigen)
  if (opts.statusFilter.length > 0) {
    out = out.filter(b => {
      return opts.statusFilter.some(f => {
        if (f === 'geloescht')    return b.deleted;
        if (f === 'rechnung')     return !b.deleted && b.rechnungErstellt;
        if (f === 'abgeschlossen') return !b.deleted && b.abgeschlossen && !b.rechnungErstellt;
        if (f === 'offen')        return !b.deleted && !b.abgeschlossen;
        return false;
      });
    });
  }

  if (opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(b => textMatch(b, q, objekte));
  }

  out.sort(byBestellungsnr);
  return out;
}

/** Per-Tab Steuerungs-State */
interface TabControls { search: string; objekt: string; sort: SortOpt; }
const INIT_CONTROLS: TabControls = { search: '', objekt: 'alle', sort: 'datum' };

interface AlleControls { search: string; statusFilter: StatusFilter[]; }
const INIT_ALLE: AlleControls = { search: '', statusFilter: [] };

const STATUS_FILTER_CONFIG: { id: StatusFilter; label: string; activeClass: string }[] = [
  { id: 'offen',         label: 'Offen',          activeClass: 'filterChipActiveOffen' },
  { id: 'abgeschlossen', label: 'Abgeschlossen',   activeClass: 'filterChipActiveAbgeschlossen' },
  { id: 'rechnung',      label: '✅ Rechnung',     activeClass: 'filterChipActiveRechnung' },
  { id: 'geloescht',     label: 'Gelöscht',        activeClass: 'filterChipActiveGeloescht' },
];

export function BuchhaltungScreen({ onOpenBeleg, onRechnungErstellen }: Props) {
  const belege = useBelegStore(st => st.belege);
  const objekte = useObjektStore(st => st.objekte);

  const [tab, setTab] = useState<BuchTab>('alle');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [ctrlAlle,  setCtrlAlle]  = useState<AlleControls>(INIT_ALLE);
  const [ctrlUeber, setCtrlUeber] = useState<TabControls>(INIT_CONTROLS);
  const [ctrlBereit, setCtrlBereit] = useState<TabControls>(INIT_CONTROLS);
  const [ctrlErl,   setCtrlErl]   = useState<TabControls>(INIT_CONTROLS);

  const now = new Date();
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

  const bereitBase = useMemo(() =>
    belege.filter(b => !b.deleted && b.abgeschlossen && !b.rechnungErstellt), [belege]);

  const erledigtBase = useMemo(() =>
    belege.filter(b => !b.deleted && b.rechnungErstellt), [belege]);

  const alleBelege      = useMemo(() => applyAlleControls(alleBase,        objekte, ctrlAlle),  [alleBase,        objekte, ctrlAlle]);
  const ueberfaelligBelege = useMemo(() => applyControls(ueberfaelligBase, objekte, ctrlUeber), [ueberfaelligBase, objekte, ctrlUeber]);
  const bereitBelege    = useMemo(() => applyControls(bereitBase,          objekte, ctrlBereit),[bereitBase,       objekte, ctrlBereit]);
  const erledigtBelege  = useMemo(() => applyControls(erledigtBase,        objekte, ctrlErl),   [erledigtBase,     objekte, ctrlErl]);

  const TAB_CONFIG = [
    { id: 'alle'         as BuchTab, label: 'Alle\nBewirtungen',       count: alleBase.length,         urgent: false },
    { id: 'ueberfaellig' as BuchTab, label: 'Bewirtungen\nüberfällig', count: ueberfaelligBase.length, urgent: true  },
    { id: 'bereit'       as BuchTab, label: 'Bereit für\nRechnung',    count: bereitBase.length,       urgent: false },
    { id: 'erledigt'     as BuchTab, label: 'Rechnung\nerstellt',      count: erledigtBase.length,     urgent: false },
  ];

  const displayList =
    tab === 'alle'         ? alleBelege :
    tab === 'ueberfaellig' ? ueberfaelligBelege :
    tab === 'bereit'       ? bereitBelege :
    erledigtBelege;

  const ctrl    = tab === 'ueberfaellig' ? ctrlUeber : tab === 'bereit' ? ctrlBereit : ctrlErl;
  const setCtrl = tab === 'ueberfaellig' ? setCtrlUeber : tab === 'bereit' ? setCtrlBereit : setCtrlErl;

  function toggleStatusFilter(id: StatusFilter) {
    setCtrlAlle(c => ({
      ...c,
      statusFilter: c.statusFilter.includes(id)
        ? c.statusFilter.filter(f => f !== id)
        : [...c.statusFilter, id],
    }));
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.rolleChip}>Buchhaltung</span>
      </div>

      <div className={s.content}>

        {/* ── Alle Bewirtungen: Suche + Status-Filter-Chips ── */}
        {tab === 'alle' && (
          <div className={s.filters}>
            <input
              className={s.searchInput}
              type="search"
              placeholder="🔍 Datum, Bestellnr., Veranstaltung, Besteller, Objekt…"
              value={ctrlAlle.search}
              onChange={e => setCtrlAlle(c => ({ ...c, search: e.target.value }))}
            />
            <div className={s.filterChipsRow}>
              {STATUS_FILTER_CONFIG.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`${s.filterChip} ${ctrlAlle.statusFilter.includes(f.id) ? s[f.activeClass] : ''}`}
                  onClick={() => toggleStatusFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Überfällig / Bereit / Erledigt: Suche + Objekt + Sortierung ── */}
        {tab !== 'alle' && (
          <div className={s.filters}>
            <input
              className={s.searchInput}
              type="search"
              placeholder="🔍 Datum, Bestellnr., Veranstaltung, Besteller, Objekt…"
              value={ctrl.search}
              onChange={e => setCtrl(c => ({ ...c, search: e.target.value }))}
            />
            <select
              className={s.select}
              value={ctrl.objekt}
              onChange={e => setCtrl(c => ({ ...c, objekt: e.target.value }))}
            >
              <option value="alle">Alle Objekte</option>
              {objekte.map(o => (
                <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ${o.name}` : o.name}</option>
              ))}
            </select>
            <div className={s.sortRow}>
              <span className={s.sortLabel}>Sortierung:</span>
              <button type="button"
                className={`${s.sortBtn} ${ctrl.sort === 'datum' ? s.sortBtnActive : ''}`}
                onClick={() => setCtrl(c => ({ ...c, sort: 'datum' }))}>
                📅 Bewirtungsdatum
              </button>
              <button type="button"
                className={`${s.sortBtn} ${ctrl.sort === 'bestellnr' ? s.sortBtnActive : ''}`}
                onClick={() => setCtrl(c => ({ ...c, sort: 'bestellnr' }))}>
                # Bestellnr. ↑
              </button>
              {tab === 'erledigt' && (
                <button type="button"
                  className={`${s.sortBtn} ${ctrl.sort === 'bestellnr-desc' ? s.sortBtnActive : ''}`}
                  onClick={() => setCtrl(c => ({ ...c, sort: 'bestellnr-desc' }))}>
                  # Bestellnr. ↓
                </button>
              )}
              {tab === 'erledigt' && (
                <button type="button"
                  className={`${s.sortBtn} ${ctrl.sort === 'rechnungsnr' ? s.sortBtnActive : ''}`}
                  onClick={() => setCtrl(c => ({ ...c, sort: 'rechnungsnr' }))}>
                  🧾 Rechnungsnr. ↑
                </button>
              )}
              {tab === 'erledigt' && (
                <button type="button"
                  className={`${s.sortBtn} ${ctrl.sort === 'rechnungsnr-desc' ? s.sortBtnActive : ''}`}
                  onClick={() => setCtrl(c => ({ ...c, sort: 'rechnungsnr-desc' }))}>
                  🧾 Rechnungsnr. ↓
                </button>
              )}
            </div>
          </div>
        )}

        {/* Liste */}
        <div className={s.list}>
          {displayList.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>
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

      {/* Bottom Nav */}
      <nav className={s.nav}>
        <button type="button" className={s.hamburgerBtn} onClick={() => setDrawerOpen(true)}>
          <span className={s.hamburger}><span /><span /><span /></span>
          <span className={s.navLabel}>Menü</span>
        </button>
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${s.navTab} ${tab === t.id ? s.navTabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={s.navLabel} style={{ whiteSpace: 'pre-line', fontSize: 10 }}>{t.label}</span>
            {t.count > 0 && (
              <span className={`${s.badge} ${t.urgent ? s.badgeUrgent : ''}`}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {drawerOpen && (
        <HamburgerDrawer onClose={() => setDrawerOpen(false)} onAbgeschlossene={() => {}} />
      )}
    </div>
  );
}

/* ─── Einzelne Beleg-Zeile ─── */
function BelegeRow({ beleg: b, objekte, onOpen, showRechnungBtn, onMarkRechnung }: {
  beleg: Bewirtungsbeleg;
  objekte: ReturnType<typeof useObjektStore.getState>['objekte'];
  onOpen: () => void;
  showRechnungBtn: boolean;
  onMarkRechnung: () => void;
}) {
  const datum = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
  const objekt = objekte.find(o => o.id === b.objektId);

  return (
    <div className={`${s.row} ${b.deleted ? s.rowDeleted : b.rechnungErstellt ? s.rowErledigt : !b.abgeschlossen ? s.rowOffen : ''}`}>
      <div className={s.rowMain} onClick={onOpen}>
        <div className={s.rowTop}>
          <span className={s.rowNr}>{b.bestellungsnummer ?? '–'}</span>
          {b.rechnungsnummer && <span className={s.rowRechnungNr}>🧾 {b.rechnungsnummer}</span>}
          {b.deleted
            ? <span className={s.chipDeleted}>Bewirtung gelöscht</span>
            : b.abgeschlossen
              ? <span className={s.chipDone}>Abgeschlossen</span>
              : <span className={s.chipOffen}>Offen</span>}
          {b.rechnungErstellt && <span className={s.chipRechnung}>✅ Rechnung</span>}
        </div>
        <div className={s.rowTitle}>{b.veranstaltung || 'Bewirtung'}</div>
        <div className={s.rowMeta}>
          <span>📅 {datum}</span>
          {b.uhrzeitVon && <span>🕐 {b.uhrzeitVon}–{b.uhrzeitBis}</span>}
          <span>👥 {b.personenzahl} Pers.</span>
          {objekt && <span>🏢 {objekt.kuerzel ?? objekt.name}</span>}
          <span>{b.besteller}</span>
        </div>
      </div>
      {showRechnungBtn && (
        <button
          type="button"
          className={`${s.rechnungBtn} ${b.rechnungErstellt ? s.rechnungBtnDone : ''}`}
          onClick={onMarkRechnung}
          title={b.rechnungErstellt ? `Erstellt von ${b.rechnungErstelltVon ?? ''}` : 'Als "Rechnung erstellt" markieren'}
        >
          {b.rechnungErstellt ? '✅ Rechnung erstellt' : '☐ Rechnung erstellen'}
        </button>
      )}
    </div>
  );
}

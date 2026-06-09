import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { HamburgerDrawer } from '../components/HamburgerDrawer';
import type { Bewirtungsbeleg } from '../types';
import s from './BuchhaltungScreen.module.css';

type BuchTab = 'alle' | 'ueberfaellig' | 'bereit' | 'erledigt';
type UeberfaelligSort = 'datum' | 'bestellnr';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; }

function byBestellungsnr(a: Bewirtungsbeleg, b: Bewirtungsbeleg) {
  return (a.bestellungsnummer ?? '').localeCompare(b.bestellungsnummer ?? '');
}

/** Sortiert nach Datum + Uhrzeit aufsteigend */
function byDatumUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg) {
  const keyA = `${a.cateringDatumVon}T${a.uhrzeitVon ?? '00:00'}`;
  const keyB = `${b.cateringDatumVon}T${b.uhrzeitVon ?? '00:00'}`;
  return keyA.localeCompare(keyB);
}

export function BuchhaltungScreen({ onOpenBeleg }: Props) {
  const belege = useBelegStore(st => st.belege);
  const markRechnung = useBelegStore(st => st.markRechnungErstellt);
  const objekte = useObjektStore(st => st.objekte);
  const user = useAuthStore(st => st.user);

  const [tab, setTab] = useState<BuchTab>('alle');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // "Bereit für Rechnung" Filter
  const [filterObjekt, setFilterObjekt] = useState('alle');
  const [filterDatumVon, setFilterDatumVon] = useState('');
  const [filterDatumBis, setFilterDatumBis] = useState('');

  // "Überfällig" Steuerung
  const [ueberfaelligSort, setUeberfaelligSort] = useState<UeberfaelligSort>('datum');
  const [ueberfaelligSearch, setUeberfaelligSearch] = useState('');
  const [ueberfaelligObjekt, setUeberfaelligObjekt] = useState('alle');

  const now = new Date();
  const nowDate = format(now, 'yyyy-MM-dd');
  const nowTime = format(now, 'HH:mm');

  const alleBelege = useMemo(() =>
    belege.filter(b => !b.deleted).sort(byBestellungsnr),
    [belege]
  );

  const ueberfaelligBase = useMemo(() =>
    belege.filter(b => {
      if (b.deleted || b.abgeschlossen) return false;
      if (b.cateringDatumVon < nowDate) return true;
      if (b.cateringDatumVon === nowDate && b.uhrzeitBis && b.uhrzeitBis < nowTime) return true;
      return false;
    }),
    [belege, nowDate, nowTime]
  );

  const ueberfaelligBelege = useMemo(() => {
    let list = [...ueberfaelligBase];

    // Objekt-Filter
    if (ueberfaelligObjekt !== 'alle') {
      list = list.filter(b => b.objektId === ueberfaelligObjekt);
    }

    // Suche: Datum, Bestellnummer, Veranstaltung, Besteller, Objekt
    if (ueberfaelligSearch.trim()) {
      const q = ueberfaelligSearch.trim().toLowerCase();
      list = list.filter(b => {
        const datumFormatted = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy');
        const objektName = objekte.find(o => o.id === b.objektId);
        return (
          datumFormatted.includes(q) ||
          (b.bestellungsnummer ?? '').toLowerCase().includes(q) ||
          (b.veranstaltung ?? '').toLowerCase().includes(q) ||
          (b.besteller ?? '').toLowerCase().includes(q) ||
          (objektName?.name ?? '').toLowerCase().includes(q) ||
          (objektName?.kuerzel ?? '').toLowerCase().includes(q)
        );
      });
    }

    // Sortierung
    list.sort(ueberfaelligSort === 'datum' ? byDatumUhrzeit : byBestellungsnr);
    return list;
  }, [ueberfaelligBase, ueberfaelligSort, ueberfaelligSearch, ueberfaelligObjekt, objekte]);

  const bereitBase = useMemo(() =>
    belege.filter(b => !b.deleted && b.abgeschlossen && !b.rechnungErstellt),
    [belege]
  );

  const bereitBelege = useMemo(() => {
    return bereitBase.filter(b => {
      if (filterObjekt !== 'alle' && b.objektId !== filterObjekt) return false;
      if (filterDatumVon && b.cateringDatumVon < filterDatumVon) return false;
      if (filterDatumBis && b.cateringDatumVon > filterDatumBis) return false;
      return true;
    }).sort(byBestellungsnr);
  }, [bereitBase, filterObjekt, filterDatumVon, filterDatumBis]);

  const erledigtBelege = useMemo(() =>
    belege.filter(b => !b.deleted && b.rechnungErstellt).sort(byBestellungsnr),
    [belege]
  );

  const TAB_CONFIG = [
    { id: 'alle'         as BuchTab, label: 'Alle\nBewirtungen',     count: alleBelege.length,           urgent: false },
    { id: 'ueberfaellig' as BuchTab, label: 'Bewirtungen\nüberfällig', count: ueberfaelligBase.length,   urgent: true  },
    { id: 'bereit'       as BuchTab, label: 'Bereit für\nRechnung',  count: bereitBase.length,           urgent: false },
    { id: 'erledigt'     as BuchTab, label: 'Rechnung\nerstellt',    count: erledigtBelege.length,       urgent: false },
  ];

  const displayList =
    tab === 'alle'         ? alleBelege :
    tab === 'ueberfaellig' ? ueberfaelligBelege :
    tab === 'bereit'       ? bereitBelege :
    erledigtBelege;

  return (
    <div className={s.screen}>
      {/* Header */}
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.rolleChip}>Buchhaltung</span>
      </div>

      {/* Tab-spezifische Steuerung */}
      <div className={s.content}>

        {/* Überfällig: Suche + Sortierung */}
        {tab === 'ueberfaellig' && (
          <div className={s.filters}>
            <input
              className={s.searchInput}
              type="search"
              placeholder="🔍 Datum, Bestellnr., Veranstaltung, Besteller, Objekt…"
              value={ueberfaelligSearch}
              onChange={e => setUeberfaelligSearch(e.target.value)}
            />
            <select className={s.select} value={ueberfaelligObjekt} onChange={e => setUeberfaelligObjekt(e.target.value)}>
              <option value="alle">Alle Objekte</option>
              {objekte.map(o => <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ${o.name}` : o.name}</option>)}
            </select>
            <div className={s.sortRow}>
              <span className={s.sortLabel}>Sortierung:</span>
              <button
                type="button"
                className={`${s.sortBtn} ${ueberfaelligSort === 'datum' ? s.sortBtnActive : ''}`}
                onClick={() => setUeberfaelligSort('datum')}
              >
                📅 Bewirtungsdatum
              </button>
              <button
                type="button"
                className={`${s.sortBtn} ${ueberfaelligSort === 'bestellnr' ? s.sortBtnActive : ''}`}
                onClick={() => setUeberfaelligSort('bestellnr')}
              >
                # Bestellnummer
              </button>
            </div>
          </div>
        )}

        {/* Bereit für Rechnung: Objekt- + Datumsfilter */}
        {tab === 'bereit' && (
          <div className={s.filters}>
            <select className={s.select} value={filterObjekt} onChange={e => setFilterObjekt(e.target.value)}>
              <option value="alle">Alle Objekte</option>
              {objekte.map(o => <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ${o.name}` : o.name}</option>)}
            </select>
            <div className={s.dateRow}>
              <input type="date" className={s.dateInput} value={filterDatumVon} onChange={e => setFilterDatumVon(e.target.value)} />
              <span className={s.dateSep}>–</span>
              <input type="date" className={s.dateInput} value={filterDatumBis} onChange={e => setFilterDatumBis(e.target.value)} />
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
                showRechnungBtn={tab === 'bereit'}
                onMarkRechnung={() => markRechnung(b.id, user?.name)}
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
    <div className={`${s.row} ${b.rechnungErstellt ? s.rowErledigt : !b.abgeschlossen ? s.rowOffen : ''}`}>
      <div className={s.rowMain} onClick={onOpen}>
        <div className={s.rowTop}>
          <span className={s.rowNr}>{b.bestellungsnummer ?? '–'}</span>
          {b.abgeschlossen
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

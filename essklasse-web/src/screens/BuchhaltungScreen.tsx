import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import type { Bewirtungsbeleg } from '../types';
import s from './BuchhaltungScreen.module.css';

interface Props {
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
}

export function BuchhaltungScreen({ onOpenBeleg }: Props) {
  const belege = useBelegStore(st => st.belege);
  const markRechnung = useBelegStore(st => st.markRechnungErstellt);
  const objekte = useObjektStore(st => st.objekte);
  const user = useAuthStore(st => st.user);

  const [filterObjekt, setFilterObjekt] = useState<string>('alle');
  const [filterStatus, setFilterStatus] = useState<'alle' | 'offen' | 'erledigt'>('alle');
  const [search, setSearch] = useState('');

  // Buchhaltung sieht alle abgeschlossenen Belege aller Objekte
  const gefiltert = useMemo(() => {
    return belege.filter(b => {
      if (b.deleted) return false;
      if (!b.abgeschlossen) return false;
      if (filterObjekt !== 'alle' && b.objektId !== filterObjekt) return false;
      if (filterStatus === 'offen' && b.rechnungErstellt) return false;
      if (filterStatus === 'erledigt' && !b.rechnungErstellt) return false;
      if (search && !b.veranstaltung?.toLowerCase().includes(search.toLowerCase()) &&
          !b.besteller?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.cateringDatumVon.localeCompare(a.cateringDatumVon));
  }, [belege, filterObjekt, filterStatus, search]);

  const offenCount = useMemo(() =>
    belege.filter(b => !b.deleted && b.abgeschlossen && !b.rechnungErstellt).length,
    [belege]
  );

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <div className={s.headerRight}>
          <span className={s.rolleChip}>Buchhaltung</span>
        </div>
      </div>

      <div className={s.summary}>
        <div className={s.summaryCard}>
          <div className={s.summaryNum}>{offenCount}</div>
          <div className={s.summaryLabel}>Rechnung ausstehend</div>
        </div>
        <div className={`${s.summaryCard} ${s.summaryDone}`}>
          <div className={s.summaryNum}>
            {belege.filter(b => !b.deleted && b.rechnungErstellt).length}
          </div>
          <div className={s.summaryLabel}>Rechnung erstellt</div>
        </div>
      </div>

      {/* Filter */}
      <div className={s.filters}>
        <input
          className={s.search}
          type="search"
          placeholder="🔍 Suche…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={s.filterRow}>
          <select
            className={s.select}
            value={filterObjekt}
            onChange={e => setFilterObjekt(e.target.value)}
          >
            <option value="alle">Alle Objekte</option>
            {objekte.map(o => <option key={o.id} value={o.id}>{o.kuerzel ?? o.name}</option>)}
          </select>
          <div className={s.statusTabs}>
            {(['alle', 'offen', 'erledigt'] as const).map(v => (
              <button
                key={v}
                type="button"
                className={`${s.statusTab} ${filterStatus === v ? s.statusTabActive : ''}`}
                onClick={() => setFilterStatus(v)}
              >
                {v === 'alle' ? 'Alle' : v === 'offen' ? 'Ausstehend' : 'Erledigt'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={s.list}>
        {gefiltert.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>📋</div>
            <p>Keine Bewirtungen gefunden.</p>
          </div>
        ) : (
          gefiltert.map(b => {
            const datum = format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
            const objekt = objekte.find(o => o.id === b.objektId);
            return (
              <div key={b.id} className={`${s.row} ${b.rechnungErstellt ? s.rowDone : ''}`}>
                <div className={s.rowMain} onClick={() => onOpenBeleg(b)}>
                  <div className={s.rowTitle}>{b.veranstaltung || 'Bewirtung'}</div>
                  <div className={s.rowMeta}>
                    <span>📅 {datum}</span>
                    <span>👥 {b.personenzahl} Pers.</span>
                    {objekt && <span>🏢 {objekt.kuerzel ?? objekt.name}</span>}
                    <span className={s.rowBesteller}>{b.besteller}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${s.rechnungBtn} ${b.rechnungErstellt ? s.rechnungBtnDone : ''}`}
                  onClick={() => markRechnung(b.id, user?.name)}
                  title={b.rechnungErstellt ? `Erstellt am ${b.rechnungErstelltAm ? format(parseISO(b.rechnungErstelltAm), 'dd.MM.yy HH:mm') : ''} von ${b.rechnungErstelltVon ?? ''}` : 'Als "Rechnung erstellt" markieren'}
                >
                  {b.rechnungErstellt ? '✅ Rechnung erstellt' : '☐ Rechnung erstellen'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

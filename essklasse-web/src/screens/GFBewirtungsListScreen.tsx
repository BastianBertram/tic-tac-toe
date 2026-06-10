import { useMemo, useState } from 'react';
import { startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import type { Bewirtungsbeleg } from '../types';
import s from './GFBewirtungsListScreen.module.css';

export type GFKategorie = 'diese-woche' | 'naechste-woche' | 'ueberfaellig' | 'rechnungsbereit';

const TITEL: Record<GFKategorie, string> = {
  'diese-woche':      'Geplante Bewirtungen diese Woche',
  'naechste-woche':   'Geplante Bewirtungen nächste Woche',
  'ueberfaellig':     'Überfällige Bewirtungen',
  'rechnungsbereit':  'Bewirtungen bereit zur Rechnungserstellung',
};

type SortKey = 'datum-asc' | 'datum-desc' | 'nr-asc' | 'nr-desc';

interface Props { kategorie: GFKategorie; onClose: () => void; }

export function GFBewirtungsListScreen({ kategorie, onClose }: Props) {
  const belege = useBelegStore(st => st.belege);
  const [suche, setSuche]   = useState('');
  const [sort, setSort]     = useState<SortKey>('datum-asc');

  const gefiltert = useMemo(() => {
    const now     = new Date();
    const today   = format(now, 'yyyy-MM-dd');
    const nowTime = format(now, 'HH:mm');
    const wStart  = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd    = endOfWeek(now,   { weekStartsOn: 1 });
    const nwStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nwEnd   = endOfWeek(addWeeks(now, 1),   { weekStartsOn: 1 });

    const active = belege.filter(b => !b.deleted);

    let liste: Bewirtungsbeleg[];
    switch (kategorie) {
      case 'diese-woche':
        liste = active.filter(b => isWithinInterval(parseISO(b.cateringDatumVon), { start: wStart, end: wEnd }));
        break;
      case 'naechste-woche':
        liste = active.filter(b => isWithinInterval(parseISO(b.cateringDatumVon), { start: nwStart, end: nwEnd }));
        break;
      case 'ueberfaellig':
        liste = active.filter(b => {
          if (b.abgeschlossen) return false;
          if (b.cateringDatumVon < today) return true;
          if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < nowTime) return true;
          return false;
        });
        break;
      case 'rechnungsbereit':
        liste = active.filter(b => b.abgeschlossen && !b.rechnungErstellt);
        break;
    }

    const q = suche.trim().toLowerCase();
    if (q) {
      liste = liste.filter(b =>
        b.veranstaltung?.toLowerCase().includes(q) ||
        b.bestellungsnummer?.toLowerCase().includes(q) ||
        b.objektName?.toLowerCase().includes(q) ||
        b.besteller?.toLowerCase().includes(q)
      );
    }

    return [...liste].sort((a, b) => {
      switch (sort) {
        case 'datum-asc':  return a.cateringDatumVon.localeCompare(b.cateringDatumVon);
        case 'datum-desc': return b.cateringDatumVon.localeCompare(a.cateringDatumVon);
        case 'nr-asc':     return a.bestellungsnummer.localeCompare(b.bestellungsnummer);
        case 'nr-desc':    return b.bestellungsnummer.localeCompare(a.bestellungsnummer);
      }
    });
  }, [belege, kategorie, suche, sort]);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitle}>{TITEL[kategorie]}</span>
      </div>

      <div className={s.toolbar}>
        <input
          className={s.suche}
          type="search"
          placeholder="Suche nach Veranstaltung, Nr., Objekt …"
          value={suche}
          onChange={e => setSuche(e.target.value)}
        />
        <select className={s.sortSelect} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="datum-asc">Datum ↑</option>
          <option value="datum-desc">Datum ↓</option>
          <option value="nr-asc">Bestellnr. ↑</option>
          <option value="nr-desc">Bestellnr. ↓</option>
        </select>
      </div>

      <div className={s.list}>
        {gefiltert.length === 0 && (
          <p className={s.leer}>Keine Bewirtungen gefunden.</p>
        )}
        {gefiltert.map(b => (
          <div key={b.id} className={s.item}>
            <div className={s.itemTop}>
              <span className={s.itemNr}>{b.bestellungsnummer}</span>
              <span className={s.itemDatum}>
                {format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy', { locale: de })}
                {b.uhrzeitVon ? ` · ${b.uhrzeitVon}` : ''}
              </span>
            </div>
            <div className={s.itemTitle}>{b.veranstaltung || '—'}</div>
            <div className={s.itemMeta}>
              <span>🏢 {b.objektName}</span>
              {b.raum ? <span>📍 {b.raum}</span> : null}
              {b.personenzahl ? <span>👥 {b.personenzahl} Pers.</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { SALES_PIPELINE, SALES_STATUS_LABEL } from '../../types';
import type { SalesAnfrage, SalesStatus } from '../../types';
import { euroFull, statusColor, isOffen, segmentLabel, useSichtbareAnfragen } from './salesUtils';
import s from './SalesPipelineScreen.module.css';

type Filter = SalesStatus | 'alle' | 'wiedervorlage';

interface Props { initialFilter?: Filter; onOpen: (a: SalesAnfrage) => void; }

export function SalesPipelineScreen({ initialFilter = 'alle', onOpen }: Props) {
  const anfragen = useSichtbareAnfragen();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [suche, setSuche]   = useState('');

  const heute = format(new Date(), 'yyyy-MM-dd');

  const gefiltert = useMemo(() => {
    let liste = [...anfragen];
    if (filter === 'wiedervorlage') {
      liste = liste.filter(a => isOffen(a) && a.wiedervorlage && a.wiedervorlage <= heute);
    } else if (filter !== 'alle') {
      liste = liste.filter(a => a.status === filter);
    }
    const q = suche.trim().toLowerCase();
    if (q) {
      liste = liste.filter(a =>
        a.kundeFirma.toLowerCase().includes(q) ||
        a.veranstaltung.toLowerCase().includes(q) ||
        a.ansprechpartner.toLowerCase().includes(q) ||
        a.nummer.toLowerCase().includes(q)
      );
    }
    return liste;
  }, [anfragen, filter, suche, heute]);

  // Gruppierung nach Pipeline-Stufe (nur belegte Stufen)
  const gruppen = useMemo(() => {
    return SALES_PIPELINE
      .map(st => ({ status: st, items: gefiltert.filter(a => a.status === st) }))
      .filter(g => g.items.length > 0);
  }, [gefiltert]);

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'alle',          label: 'Alle' },
    { value: 'wiedervorlage', label: '⏰ Fällig' },
    ...SALES_PIPELINE.map(st => ({ value: st as Filter, label: SALES_STATUS_LABEL[st] })),
  ];

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <span className={s.headerTitle}>📈 Pipeline</span>
      </div>

      <div className={s.toolbar}>
        <input
          className={s.suche}
          type="search"
          placeholder="🔍 Kunde, Veranstaltung, Ansprechpartner, Nr.…"
          value={suche}
          onChange={e => setSuche(e.target.value)}
        />
        <div className={s.chips}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              className={`${s.chip} ${filter === f.value ? s.chipActive : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.list}>
        {gruppen.length === 0 && <p className={s.leer}>Keine Anfragen in dieser Ansicht.</p>}
        {gruppen.map(g => {
          const summe = g.items.reduce((sum, a) => sum + (a.geschaetzterWert || 0), 0);
          return (
            <div key={g.status} className={s.group}>
              <div className={s.groupHead}>
                <span className={s.groupDot} style={{ background: statusColor(g.status) }} />
                <span className={s.groupTitle}>{SALES_STATUS_LABEL[g.status]}</span>
                <span className={s.groupCount}>{g.items.length}</span>
                <span className={s.groupSum}>{euroFull(summe)}</span>
              </div>
              {g.items.map(a => {
                const faellig = isOffen(a) && a.wiedervorlage && a.wiedervorlage <= heute;
                return (
                  <button key={a.id} type="button" className={s.card} onClick={() => onOpen(a)}>
                    <div className={s.cardTop}>
                      <span className={s.cardNr}>{a.nummer}</span>
                      <span className={s.cardWert}>{euroFull(a.geschaetzterWert)}</span>
                    </div>
                    <div className={s.cardFirma}>{a.kundeFirma}</div>
                    <div className={s.cardVeranst}>{a.veranstaltung}</div>
                    <div className={s.cardMeta}>
                      <span className={s.tag} style={{ borderColor: statusColor(a.status), color: statusColor(a.status) }}>
                        {segmentLabel(a.segment)}
                      </span>
                      {a.datum && <span>📅 {format(parseISO(a.datum), 'dd.MM.yy', { locale: de })}</span>}
                      {a.personenzahl > 0 && <span>👥 {a.personenzahl}</span>}
                      {faellig && <span className={s.faellig}>⏰ fällig</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

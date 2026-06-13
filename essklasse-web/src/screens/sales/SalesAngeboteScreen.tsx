import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ANGEBOT_PIPELINE, ANGEBOT_STATUS_LABEL } from '../../types';
import type { Angebot, AngebotStatus } from '../../types';
import { euroFull } from './salesUtils';
import { useSichtbareAngebote, angebotStatusColor } from './angebotUtils';
import s from './AngeboteScreen.module.css';

type Filter = AngebotStatus | 'alle';

interface Props { onOpen: (a: Angebot) => void; }

export function SalesAngeboteScreen({ onOpen }: Props) {
  const angebote = useSichtbareAngebote();
  const [filter, setFilter] = useState<Filter>('alle');
  const [suche, setSuche]   = useState('');

  const gefiltert = useMemo(() => {
    let liste = [...angebote];
    if (filter !== 'alle') liste = liste.filter(a => a.status === filter);
    const q = suche.trim().toLowerCase();
    if (q) {
      liste = liste.filter(a =>
        a.kundeFirma.toLowerCase().includes(q) ||
        (a.betreff ?? '').toLowerCase().includes(q) ||
        a.nummer.toLowerCase().includes(q)
      );
    }
    return liste;
  }, [angebote, filter, suche]);

  const gruppen = useMemo(() =>
    ANGEBOT_PIPELINE
      .map(st => ({ status: st, items: gefiltert.filter(a => a.status === st) }))
      .filter(g => g.items.length > 0)
  , [gefiltert]);

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'alle', label: 'Alle' },
    ...ANGEBOT_PIPELINE.map(st => ({ value: st as Filter, label: ANGEBOT_STATUS_LABEL[st] })),
  ];

  return (
    <div className={s.screen}>
      <div className={`${s.header} ${s.headerCenter}`}>
        <span className={s.headerTitle}>📄 Angebote</span>
      </div>

      <div className={s.toolbar}>
        <input
          className={s.suche}
          type="search"
          placeholder="🔍 Kunde, Betreff, Nr.…"
          value={suche}
          onChange={e => setSuche(e.target.value)}
        />
        <div className={s.chips}>
          {FILTERS.map(f => (
            <button key={f.value} type="button"
              className={`${s.chip} ${filter === f.value ? s.chipActive : ''}`}
              onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.list}>
        {gruppen.length === 0 && <p className={s.leer}>Noch keine Angebote. Mit „+" ein neues anlegen.</p>}
        {gruppen.map(g => {
          const summe = g.items.reduce((sum, a) => sum + (a.gesamtsumme || 0), 0);
          return (
            <div key={g.status} className={s.group}>
              <div className={s.groupHead}>
                <span className={s.groupDot} style={{ background: angebotStatusColor(g.status) }} />
                <span className={s.groupTitle}>{ANGEBOT_STATUS_LABEL[g.status]}</span>
                <span className={s.groupCount}>{g.items.length}</span>
                <span className={s.groupSum}>{euroFull(summe)}</span>
              </div>
              {g.items.map(a => {
                const wartetFreigabe = a.genehmigungErforderlich && !a.genehmigtVon;
                return (
                  <button key={a.id} type="button" className={s.card} onClick={() => onOpen(a)}>
                    <div className={s.cardTop}>
                      <span className={s.cardNr}>{a.nummer}</span>
                      <span className={s.cardWert}>{euroFull(a.gesamtsumme)}</span>
                    </div>
                    <div className={s.cardFirma}>{a.kundeFirma}</div>
                    {a.betreff && <div className={s.cardBetreff}>{a.betreff}</div>}
                    <div className={s.cardMeta}>
                      <span className={s.tag ?? ''} style={{ color: angebotStatusColor(a.status), fontWeight: 800 }}>
                        {ANGEBOT_STATUS_LABEL[a.status]}
                      </span>
                      {a.gueltigBis && <span>⏳ {format(parseISO(a.gueltigBis), 'dd.MM.yy', { locale: de })}</span>}
                      {a.versionen.length > 0 && <span>v{a.versionen[a.versionen.length - 1].version}</span>}
                      {wartetFreigabe && <span className={s.warnTag}>⚠ Freigabe</span>}
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

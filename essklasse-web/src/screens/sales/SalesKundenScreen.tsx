import { useMemo, useState } from 'react';
import { useSalesStore } from '../../store/salesStore';
import type { SalesAnfrage } from '../../types';
import { euroFull, isOffen, statusColor, segmentLabel } from './salesUtils';
import { SALES_STATUS_LABEL } from '../../types';
import s from './SalesKundenScreen.module.css';

interface Props { onOpen: (a: SalesAnfrage) => void; }

interface Kunde {
  firma: string;
  anfragen: SalesAnfrage[];
  gewonnenWert: number;
  pipelineWert: number;
  gewonnenCount: number;
}

export function SalesKundenScreen({ onOpen }: Props) {
  const anfragen = useSalesStore(st => st.anfragen);
  const [suche, setSuche]   = useState('');
  const [offen, setOffen]   = useState<string | null>(null);

  const kunden = useMemo<Kunde[]>(() => {
    const map = new Map<string, SalesAnfrage[]>();
    anfragen.forEach(a => {
      const arr = map.get(a.kundeFirma) ?? [];
      arr.push(a);
      map.set(a.kundeFirma, arr);
    });
    const list: Kunde[] = [...map.entries()].map(([firma, arr]) => ({
      firma,
      anfragen: arr,
      gewonnenWert: arr.filter(a => a.status === 'gewonnen').reduce((sum, a) => sum + a.geschaetzterWert, 0),
      pipelineWert: arr.filter(isOffen).reduce((sum, a) => sum + a.geschaetzterWert, 0),
      gewonnenCount: arr.filter(a => a.status === 'gewonnen').length,
    }));
    const q = suche.trim().toLowerCase();
    const filtered = q ? list.filter(k => k.firma.toLowerCase().includes(q)) : list;
    return filtered.sort((a, b) => (b.gewonnenWert + b.pipelineWert) - (a.gewonnenWert + a.pipelineWert));
  }, [anfragen, suche]);

  return (
    <div className={s.screen}>
      <div className={s.header}><span className={s.headerTitle}>🤝 Kunden</span></div>

      <div className={s.toolbar}>
        <input className={s.suche} type="search" placeholder="🔍 Kunde suchen…" value={suche} onChange={e => setSuche(e.target.value)} />
      </div>

      <div className={s.list}>
        {kunden.length === 0 && <p className={s.leer}>Keine Kunden gefunden.</p>}
        {kunden.map(k => {
          const isOpen = offen === k.firma;
          return (
            <div key={k.firma} className={s.kunde}>
              <button type="button" className={s.kundeHead} onClick={() => setOffen(isOpen ? null : k.firma)}>
                <div className={s.kundeInfo}>
                  <div className={s.kundeFirma}>{k.firma}</div>
                  <div className={s.kundeMeta}>
                    {k.anfragen.length} Anfrage{k.anfragen.length !== 1 ? 'n' : ''}
                    {k.gewonnenCount > 0 && <> · 🏆 {k.gewonnenCount} gewonnen</>}
                  </div>
                </div>
                <div className={s.kundeWerte}>
                  {k.gewonnenWert > 0 && <span className={s.wonWert}>{euroFull(k.gewonnenWert)}</span>}
                  {k.pipelineWert > 0 && <span className={s.pipeWert}>+{euroFull(k.pipelineWert)} offen</span>}
                  <span className={s.chevron}>{isOpen ? '▴' : '▾'}</span>
                </div>
              </button>

              {isOpen && (
                <div className={s.anfragenList}>
                  {k.anfragen.map(a => (
                    <button key={a.id} type="button" className={s.anfrageRow} onClick={() => onOpen(a)}>
                      <span className={s.statusDot} style={{ background: statusColor(a.status) }} />
                      <div className={s.anfrageBody}>
                        <div className={s.anfrageVeranst}>{a.veranstaltung}</div>
                        <div className={s.anfrageSub}>
                          {SALES_STATUS_LABEL[a.status]} · {segmentLabel(a.segment)}
                        </div>
                      </div>
                      <span className={s.anfrageWert}>{euroFull(a.geschaetzterWert)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

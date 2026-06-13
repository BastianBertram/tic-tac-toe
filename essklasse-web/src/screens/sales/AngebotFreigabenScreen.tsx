import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAngeboteStore } from '../../store/angeboteStore';
import { euroFull } from './salesUtils';
import { AngebotDetailScreen } from './AngebotDetailScreen';
import s from './AngeboteScreen.module.css';

/**
 * Freigabe-Bereich für admin/Geschäftsführung: listet alle Angebote, die wegen
 * eines Rabatts über dem Limit auf Freigabe warten. Klick öffnet die Detail-
 * ansicht (dort Freigeben/Ablehnen). Verwaltet das Detail-Overlay selbst, damit
 * es ohne Zusatzverdrahtung in AdminScreen und GFApp eingehängt werden kann.
 */
export function AngebotFreigabenScreen() {
  const angebote = useAngeboteStore(st => st.angebote);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wartend = useMemo(
    () => angebote.filter(a => !a.deleted && a.genehmigungErforderlich && !a.genehmigtVon),
    [angebote]
  );

  if (selectedId) {
    return <AngebotDetailScreen angebotId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className={s.screen}>
      <div className={`${s.header} ${s.headerCenter}`}>
        <span className={s.headerTitle}>✓ Angebots-Freigaben</span>
      </div>

      <div className={s.list}>
        {wartend.length === 0 && <p className={s.leer}>Keine Angebote warten auf Freigabe.</p>}
        {wartend.map(a => (
          <button key={a.id} type="button" className={s.card} onClick={() => setSelectedId(a.id)}>
            <div className={s.cardTop}>
              <span className={s.cardNr}>{a.nummer}</span>
              <span className={s.cardWert}>{euroFull(a.gesamtsumme)}</span>
            </div>
            <div className={s.cardFirma}>{a.kundeFirma}</div>
            {a.betreff && <div className={s.cardBetreff}>{a.betreff}</div>}
            <div className={s.cardMeta}>
              <span className={s.warnTag}>⚠ Freigabe erforderlich</span>
              {a.gueltigBis && <span>⏳ {format(parseISO(a.gueltigBis), 'dd.MM.yy', { locale: de })}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import type { Bewirtungsbeleg } from '../types';
import s from './AbgeschlossenScreen.module.css';

interface Props {
  onClose: () => void;
  onOpenBeleg: (b: Bewirtungsbeleg) => void;
}

export function AbgeschlossenScreen({ onClose, onOpenBeleg }: Props) {
  const belege = useBelegStore(st => st.belege);

  const today     = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const abgeschlossen = belege
    .filter(b => !b.deleted && b.abgeschlossen && (b.cateringDatumVon === today || b.cateringDatumVon === yesterday))
    .sort((a, b) => b.cateringDatumVon.localeCompare(a.cateringDatumVon));

  const todayList     = abgeschlossen.filter(b => b.cateringDatumVon === today);
  const yesterdayList = abgeschlossen.filter(b => b.cateringDatumVon === yesterday);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.backBtn} onClick={onClose} type="button">← Zurück</button>
        <span className={s.title}>Abgeschlossene Bewirtungen</span>
      </div>

      <div className={s.scroll}>
        {abgeschlossen.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>✅</div>
            <div className={s.emptyText}>Keine abgeschlossenen Bewirtungen für heute oder gestern.</div>
          </div>
        ) : (
          <>
            {todayList.length > 0 && (
              <section>
                <div className={s.dayLabel}>Heute · {format(new Date(), 'dd. MMMM', { locale: de })}</div>
                {todayList.map(b => <BelegRow key={b.id} beleg={b} onClick={() => onOpenBeleg(b)} />)}
              </section>
            )}
            {yesterdayList.length > 0 && (
              <section>
                <div className={s.dayLabel}>Gestern · {format(subDays(new Date(), 1), 'dd. MMMM', { locale: de })}</div>
                {yesterdayList.map(b => <BelegRow key={b.id} beleg={b} onClick={() => onOpenBeleg(b)} />)}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BelegRow({ beleg, onClick }: { beleg: Bewirtungsbeleg; onClick: () => void }) {
  return (
    <button className={s.row} onClick={onClick} type="button">
      <div className={s.rowIcon}>✅</div>
      <div className={s.rowBody}>
        <div className={s.rowTitle}>{beleg.veranstaltung || 'Bewirtung'}</div>
        <div className={s.rowMeta}>
          {beleg.besteller} · {beleg.uhrzeitVon}–{beleg.uhrzeitBis}
          {beleg.raum ? ` · ${beleg.raum}` : ''}
        </div>
      </div>
      <div className={s.rowChevron}>›</div>
    </button>
  );
}

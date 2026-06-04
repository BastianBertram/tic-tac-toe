import type { Bewirtungsbeleg } from '../types';
import { StatusBadge } from './StatusBadge';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import s from './BelegCard.module.css';

interface Props { beleg: Bewirtungsbeleg; onClick: () => void; }

export function BelegCard({ beleg, onClick }: Props) {
  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
  const total = beleg.positionen.reduce((acc, p) => acc + p.preis * p.menge, 0);

  return (
    <div className={s.card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className={s.top}>
        <div className={s.icon}>🍽️</div>
        <div className={s.info}>
          <div className={s.title}>{beleg.veranstaltung || 'Bewirtung'}</div>
          <div className={s.sub}>{beleg.besteller} · {datum}</div>
        </div>
        <StatusBadge status={beleg.syncStatus} />
      </div>

      <div className={s.meta}>
        {beleg.raum && <span>📍 {beleg.raum}</span>}
        <span>👥 {beleg.personenzahl} Pers.</span>
        {beleg.uhrzeitVon && <span>🕐 {beleg.uhrzeitVon}–{beleg.uhrzeitBis}</span>}
      </div>

      {beleg.bcAuftragsnummer && (
        <div className={s.orderNr}>✅ BC-Auftrag: {beleg.bcAuftragsnummer}</div>
      )}

      <div className={s.footer}>
        <span className={s.posCnt}>{beleg.positionen.length} Position(en)</span>
        {beleg.fotoDataUrls.length > 0 && <span>📷 {beleg.fotoDataUrls.length}</span>}
        <span className={s.total}>{total.toFixed(2)} €</span>
      </div>
    </div>
  );
}

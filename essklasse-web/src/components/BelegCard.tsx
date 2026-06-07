import type { Bewirtungsbeleg } from '../types';
import { StatusBadge } from './StatusBadge';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import s from './BelegCard.module.css';

export type BelegHighlight = 'running' | 'next' | null;

interface Props {
  beleg: Bewirtungsbeleg;
  onClick: () => void;
  highlight?: BelegHighlight;
  onAbschliessen?: () => void;   // wenn gesetzt → Button anzeigen
}

export function BelegCard({ beleg, onClick, highlight = null, onAbschliessen }: Props) {
  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });

  return (
    <div
      className={[
        s.card,
        highlight === 'running' ? s.cardRunning : '',
        highlight === 'next'    ? s.cardNext    : '',
        beleg.abgeschlossen     ? s.cardDone    : '',
      ].join(' ')}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Status-Banner */}
      {beleg.abgeschlossen && (
        <div className={s.bannerDone}>✓ Abgeschlossen</div>
      )}
      {!beleg.abgeschlossen && highlight === 'running' && (
        <div className={s.bannerRunning}>
          <span className={s.pulseDot} />Läuft gerade
        </div>
      )}
      {!beleg.abgeschlossen && highlight === 'next' && (
        <div className={s.bannerNext}>⏰ Als nächstes</div>
      )}

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
      </div>

      {/* Abschließen-Button – nur wenn noch offen und Callback vorhanden */}
      {onAbschliessen && !beleg.abgeschlossen && (
        <button
          className={s.abschlussBtn}
          type="button"
          onClick={e => { e.stopPropagation(); onClick(); }}
        >
          Bewirtung ansehen
        </button>
      )}
    </div>
  );
}

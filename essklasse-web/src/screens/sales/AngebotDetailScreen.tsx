import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ANGEBOT_STATUS_LABEL } from '../../types';
import { useAngeboteStore } from '../../store/angeboteStore';
import { useAuthStore } from '../../store/authStore';
import { euroFull } from './salesUtils';
import { angebotStatusColor } from './angebotUtils';
import s from './AngeboteScreen.module.css';

interface Props { angebotId: string; onClose: () => void; onEdit?: (id: string) => void; }

export function AngebotDetailScreen({ angebotId, onClose, onEdit }: Props) {
  const angebot     = useAngeboteStore(st => st.angebote.find(a => a.id === angebotId));
  const setStatus   = useAngeboteStore(st => st.setStatus);
  const neueVersion = useAngeboteStore(st => st.neueVersion);
  const genehmigen  = useAngeboteStore(st => st.genehmigen);
  const ablehnen    = useAngeboteStore(st => st.ablehnen);
  const userName    = useAuthStore(st => st.user?.name);
  const darfFreigeben = useAuthStore(st => st.isAdmin() || st.isGeschaeftsfuehrung());

  if (!angebot) {
    return (
      <div className={s.screen}>
        <div className={s.header}><button className={s.back} onClick={onClose}>‹</button></div>
        <p className={s.leer}>Angebot nicht gefunden.</p>
      </div>
    );
  }

  const wartetFreigabe = angebot.genehmigungErforderlich && !angebot.genehmigtVon;
  const aktivePos = angebot.positionen.filter(p => !p.geloescht);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitleAbs}>{angebot.nummer}</span>
      </div>

      <div className={s.scroll}>
        <div className={s.titleBlock}>
          <span className={s.statusBadge} style={{ background: angebotStatusColor(angebot.status) }}>
            {ANGEBOT_STATUS_LABEL[angebot.status]}
          </span>
          <h2 className={s.firma}>{angebot.kundeFirma}</h2>
          <div className={s.betreff}>{angebot.betreff}</div>
          <div className={s.summe}>{euroFull(angebot.gesamtsumme)}</div>
        </div>

        {wartetFreigabe && (
          <div className={s.warnBox}>
            ⚠ Wartet auf Freigabe (Rabatt über Limit). {darfFreigeben ? 'Bitte freigeben oder ablehnen.' : 'Versand erst nach Freigabe durch die Geschäftsführung möglich.'}
          </div>
        )}

        {/* Aktionen */}
        <div className={s.actions}>
          {onEdit && <button type="button" className={s.btnSecondary} onClick={() => onEdit(angebot.id)}>✎ Bearbeiten</button>}
          <button type="button" className={s.btnSecondary} onClick={() => neueVersion(angebot.id, undefined, userName)}>
            + Version ({angebot.versionen.length})
          </button>
          {angebot.status !== 'versendet' && angebot.status !== 'angenommen' && (
            <button type="button" className={s.btnPrimary} disabled={wartetFreigabe} onClick={() => setStatus(angebot.id, 'versendet')}>
              ✉ Als versendet markieren
            </button>
          )}
          {darfFreigeben && wartetFreigabe && (
            <>
              <button type="button" className={s.btnApprove} onClick={() => genehmigen(angebot.id, userName)}>✓ Freigeben</button>
              <button type="button" className={s.btnReject} onClick={() => ablehnen(angebot.id, userName)}>✕ Ablehnen</button>
            </>
          )}
        </div>

        {/* Positionen */}
        <div className={s.sectionLabel}>Positionen</div>
        <div className={s.infoCard}>
          {aktivePos.length === 0 && <div className={s.row}><span className={s.rowLabel}>Keine Positionen</span></div>}
          {aktivePos.map(p => (
            <div key={p.id} className={s.posLine}>
              <div>
                <div className={s.posLineName}>{p.bezeichnung || '—'}</div>
                <div className={s.posLineSub}>
                  {p.menge} {p.einheit} × {euroFull(p.einzelpreis)}{p.rabattProzent ? ` · −${p.rabattProzent}%` : ''}
                </div>
              </div>
              <div className={s.posLineSum}>{euroFull(p.gesamt)}</div>
            </div>
          ))}
        </div>

        {/* Konditionen */}
        <div className={s.sectionLabel}>Konditionen</div>
        <div className={s.infoCard}>
          <Row label="Netto-Summe" value={euroFull(aktivePos.reduce((sum, p) => sum + p.gesamt, 0))} />
          {!!angebot.rabattGesamtProzent && <Row label="Gesamtrabatt" value={`${angebot.rabattGesamtProzent}%`} />}
          <Row label="Endpreis" value={euroFull(angebot.gesamtsumme)} />
          <Row label="Gültig bis" value={angebot.gueltigBis ? format(parseISO(angebot.gueltigBis), 'dd.MM.yyyy', { locale: de }) : '—'} />
          <Row label="Zahlung" value={angebot.zahlungsbedingungen || '—'} />
          {angebot.lieferbedingungen && <Row label="Lieferung" value={angebot.lieferbedingungen} />}
        </div>

        {/* Kontakt */}
        <div className={s.sectionLabel}>Kontakt</div>
        <div className={s.infoCard}>
          <Row label="Ansprechpartner" value={angebot.ansprechpartner || '—'} />
          <Row label="E-Mail" value={angebot.email || '—'} />
          <Row label="Telefon" value={angebot.telefon || '—'} />
        </div>

        {angebot.genehmigtVon && (
          <div className={s.sectionLabel}>Freigabe</div>
        )}
        {angebot.genehmigtVon && (
          <div className={s.infoCard}>
            <Row label="Freigegeben von" value={angebot.genehmigtVon} />
            <Row label="Am" value={angebot.genehmigtAm ? format(parseISO(angebot.genehmigtAm), 'dd.MM.yyyy HH:mm', { locale: de }) : '—'} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{value}</span>
    </div>
  );
}

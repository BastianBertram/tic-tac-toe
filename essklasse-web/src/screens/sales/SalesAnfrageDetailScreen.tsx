import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useSalesStore } from '../../store/salesStore';
import { useAuthStore } from '../../store/authStore';
import { SALES_PIPELINE, SALES_STATUS_LABEL, SALES_QUELLEN } from '../../types';
import type { SalesAktivitaetTyp } from '../../types';
import { euroFull, statusColor, segmentLabel } from './salesUtils';
import s from './SalesAnfrageDetailScreen.module.css';

interface Props { anfrageId: string; onClose: () => void; }

const AKT_ICON: Record<SalesAktivitaetTyp, string> = {
  anruf: '📞', email: '✉️', termin: '📅', notiz: '📝', angebot: '📄', statuswechsel: '🔁',
};

export function SalesAnfrageDetailScreen({ anfrageId, onClose }: Props) {
  const anfrage    = useSalesStore(st => st.anfragen.find(a => a.id === anfrageId));
  const setStatus  = useSalesStore(st => st.setStatus);
  const addAkt     = useSalesStore(st => st.addAktivitaet);
  const updateAnfrage = useSalesStore(st => st.updateAnfrage);
  const userName   = useAuthStore(st => st.user?.name);

  const [aktTyp, setAktTyp]   = useState<SalesAktivitaetTyp>('notiz');
  const [aktText, setAktText] = useState('');
  const [verlustModal, setVerlustModal] = useState(false);
  const [verlustGrund, setVerlustGrund] = useState('');

  if (!anfrage) {
    return (
      <div className={s.screen}>
        <div className={s.header}><button className={s.back} onClick={onClose}>‹</button></div>
        <p className={s.leer}>Anfrage nicht gefunden.</p>
      </div>
    );
  }

  const idx = SALES_PIPELINE.indexOf(anfrage.status);
  const nextStage = anfrage.status !== 'gewonnen' && anfrage.status !== 'verloren'
    ? SALES_PIPELINE[Math.min(idx + 1, 3)] // bis 'verhandlung'
    : null;
  const istOffen = anfrage.status !== 'gewonnen' && anfrage.status !== 'verloren';

  function advance(to: typeof anfrage.status) {
    setStatus(anfrage!.id, to, userName);
  }
  function gewinnen() { setStatus(anfrage!.id, 'gewonnen', userName); }
  function verlieren() {
    setStatus(anfrage!.id, 'verloren', userName, verlustGrund.trim() || undefined);
    setVerlustModal(false);
    setVerlustGrund('');
  }
  function addActivity() {
    if (!aktText.trim()) return;
    addAkt(anfrage!.id, aktTyp, aktText.trim(), userName);
    setAktText('');
  }

  const quelleLabel = SALES_QUELLEN.find(q => q.value === anfrage.quelle)?.label ?? anfrage.quelle;

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitle}>{anfrage.nummer}</span>
      </div>

      <div className={s.scroll}>
        {/* Kopf */}
        <div className={s.titleBlock}>
          <span className={s.statusBadge} style={{ background: statusColor(anfrage.status) }}>
            {SALES_STATUS_LABEL[anfrage.status]}
          </span>
          <h2 className={s.firma}>{anfrage.kundeFirma}</h2>
          <div className={s.veranst}>{anfrage.veranstaltung}</div>
          <div className={s.wert}>{euroFull(anfrage.geschaetzterWert)}
            <span className={s.wertSub}>{anfrage.wiederkehrend ? ' / Jahr (wiederkehrend)' : ' Auftragswert'}</span>
          </div>
        </div>

        {/* Pipeline-Fortschritt */}
        <div className={s.stages}>
          {SALES_PIPELINE.slice(0, 4).map((st, i) => (
            <div key={st} className={`${s.stageStep} ${i <= idx && istOffen ? s.stageDone : ''} ${st === anfrage.status ? s.stageCurrent : ''}`}>
              <span className={s.stageDot} style={i <= idx && istOffen ? { background: statusColor(st) } : undefined} />
              <span className={s.stageLabel}>{SALES_STATUS_LABEL[st]}</span>
            </div>
          ))}
        </div>

        {/* Status-Aktionen */}
        {istOffen && (
          <div className={s.actions}>
            {nextStage && nextStage !== anfrage.status && (
              <button type="button" className={s.btnPrimary} onClick={() => advance(nextStage)}>
                → {SALES_STATUS_LABEL[nextStage]}
              </button>
            )}
            <button type="button" className={s.btnWin} onClick={gewinnen}>🏆 Gewonnen</button>
            <button type="button" className={s.btnLose} onClick={() => setVerlustModal(true)}>✕ Verloren</button>
          </div>
        )}
        {anfrage.status === 'verloren' && anfrage.verlustgrund && (
          <div className={s.verlustInfo}>Verlustgrund: {anfrage.verlustgrund}</div>
        )}

        {/* Kontakt & Eckdaten */}
        <div className={s.sectionLabel}>Kontakt</div>
        <div className={s.infoCard}>
          <Row label="Ansprechpartner" value={anfrage.ansprechpartner} />
          <Row label="E-Mail" value={anfrage.email} />
          <Row label="Telefon" value={anfrage.telefon} />
          <Row label="Segment" value={segmentLabel(anfrage.segment)} />
          <Row label="Quelle" value={quelleLabel} />
        </div>

        <div className={s.sectionLabel}>Veranstaltung</div>
        <div className={s.infoCard}>
          <Row label="Datum" value={anfrage.datum ? format(parseISO(anfrage.datum), 'dd.MM.yyyy', { locale: de }) : '—'} />
          <Row label="Personen" value={anfrage.personenzahl ? String(anfrage.personenzahl) : '—'} />
          <Row label="Ort" value={anfrage.ort || '—'} />
        </div>

        {/* Wiedervorlage */}
        <div className={s.sectionLabel}>Wiedervorlage</div>
        <div className={s.infoCard}>
          <div className={s.wvRow}>
            <input
              type="date"
              className={s.dateInput}
              value={anfrage.wiedervorlage ?? ''}
              onChange={e => updateAnfrage(anfrage.id, { wiedervorlage: e.target.value || undefined })}
            />
            {anfrage.wiedervorlage && (
              <button type="button" className={s.clearBtn} onClick={() => updateAnfrage(anfrage.id, { wiedervorlage: undefined })}>✕</button>
            )}
          </div>
        </div>

        {anfrage.notiz && (
          <>
            <div className={s.sectionLabel}>Notiz</div>
            <div className={s.notizCard}>{anfrage.notiz}</div>
          </>
        )}

        {/* Aktivität hinzufügen */}
        <div className={s.sectionLabel}>Aktivität protokollieren</div>
        <div className={s.aktForm}>
          <div className={s.aktTypRow}>
            {(['anruf', 'email', 'termin', 'angebot', 'notiz'] as SalesAktivitaetTyp[]).map(t => (
              <button key={t} type="button"
                className={`${s.aktTypBtn} ${aktTyp === t ? s.aktTypActive : ''}`}
                onClick={() => setAktTyp(t)}>
                {AKT_ICON[t]}
              </button>
            ))}
          </div>
          <div className={s.aktInputRow}>
            <input
              className={s.aktInput}
              placeholder="Was ist passiert?"
              value={aktText}
              onChange={e => setAktText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addActivity()}
            />
            <button type="button" className={s.aktAdd} onClick={addActivity} disabled={!aktText.trim()}>+</button>
          </div>
        </div>

        {/* Verlauf */}
        <div className={s.sectionLabel}>Verlauf</div>
        <div className={s.timeline}>
          {anfrage.aktivitaeten.map(akt => (
            <div key={akt.id} className={s.tlRow}>
              <span className={s.tlIcon}>{AKT_ICON[akt.typ]}</span>
              <div className={s.tlBody}>
                <div className={s.tlText}>{akt.text}</div>
                <div className={s.tlMeta}>
                  {format(parseISO(akt.datum), 'dd.MM.yyyy HH:mm', { locale: de })}
                  {akt.von ? ` · ${akt.von}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {verlustModal && (
        <div className={s.modalOverlay} onClick={() => setVerlustModal(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalTitle}>Anfrage als verloren markieren</div>
            <input
              autoFocus
              className={s.modalInput}
              placeholder="Verlustgrund (z.B. Budget, Mitbewerber…)"
              value={verlustGrund}
              onChange={e => setVerlustGrund(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verlieren()}
            />
            <div className={s.modalActions}>
              <button type="button" className={s.modalCancel} onClick={() => setVerlustModal(false)}>Abbrechen</button>
              <button type="button" className={s.modalConfirm} onClick={verlieren}>Verloren</button>
            </div>
          </div>
        </div>
      )}
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

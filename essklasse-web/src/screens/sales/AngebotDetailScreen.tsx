import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ANGEBOT_STATUS_LABEL } from '../../types';
import { useAngeboteStore } from '../../store/angeboteStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { euroFull } from './salesUtils';
import { angebotStatusColor } from './angebotUtils';
import { AngebotVersionenTab } from './AngebotVersionenTab';
import { generateAngebotPdf } from '../../services/angebotPdf';
import { versendeAngebot } from '../../services/dataService';
import { angebotPdfInput, downloadDataUrl } from './angebotPdfUtils';
import { PdfViewer } from '../../components/PdfViewer';
import s from './AngeboteScreen.module.css';

interface Props { angebotId: string; onClose: () => void; onEdit?: (id: string) => void; }

export function AngebotDetailScreen({ angebotId, onClose, onEdit }: Props) {
  const angebot     = useAngeboteStore(st => st.angebote.find(a => a.id === angebotId));
  const setStatus   = useAngeboteStore(st => st.setStatus);
  const neueVersion = useAngeboteStore(st => st.neueVersion);
  const genehmigen  = useAngeboteStore(st => st.genehmigen);
  const ablehnen    = useAngeboteStore(st => st.ablehnen);
  const deleteAngebot = useAngeboteStore(st => st.deleteAngebot);
  const userName    = useAuthStore(st => st.user?.name);
  const darfFreigeben = useAuthStore(st => st.isAdmin() || st.isGeschaeftsfuehrung());
  const logoDataUrl = useSettingsStore(st => st.logoDataUrl);
  const impressum   = useSettingsStore(st => st.impressum);
  const [tab, setTab] = useState<'uebersicht' | 'versionen'>('uebersicht');
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [versand, setVersand] = useState<{ link: string; mailOk: boolean; empfaenger: string | null } | null>(null);
  const [deleteStep, setDeleteStep] = useState<number | null>(null);

  async function pdfErstellen() {
    if (!angebot) return;
    const url = await generateAngebotPdf(angebotPdfInput(angebot, logoDataUrl, impressum));
    setPdf({ url, name: `Angebot_${angebot.nummer}.pdf` });
  }

  async function versenden() {
    if (!angebot) return;
    const to = angebot.email?.trim();
    const ok = window.confirm(to
      ? `Angebot ${angebot.nummer} an ${to} senden?`
      : `Angebot ${angebot.nummer} versenden? Es ist keine E-Mail hinterlegt — es wird nur ein Portal-Link erzeugt.`);
    if (!ok) return;
    setSending(true);
    try {
      const pdfUrl = await generateAngebotPdf(angebotPdfInput(angebot, logoDataUrl, impressum));
      const r = await versendeAngebot(angebot.id, pdfUrl, to || undefined);
      if (r.ok) {
        setStatus(angebot.id, 'versendet');
        setVersand({ link: r.portalLink ?? '', mailOk: !!r.mailOk, empfaenger: r.empfaenger ?? null });
      } else {
        window.alert('Versand fehlgeschlagen: ' + (r.error === 'GENEHMIGUNG_OFFEN' ? 'Die Freigabe steht noch aus.' : (r.error ?? 'Unbekannter Fehler')));
      }
    } finally {
      setSending(false);
    }
  }

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

        <div className={s.detailTabs}>
          <button type="button" className={`${s.detailTab} ${tab === 'uebersicht' ? s.detailTabActive : ''}`} onClick={() => setTab('uebersicht')}>Übersicht</button>
          <button type="button" className={`${s.detailTab} ${tab === 'versionen' ? s.detailTabActive : ''}`} onClick={() => setTab('versionen')}>Versionen ({angebot.versionen.length})</button>
        </div>

        {tab === 'versionen' && <AngebotVersionenTab angebot={angebot} />}

        {tab === 'uebersicht' && <>
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
          <button type="button" className={s.btnSecondary} onClick={pdfErstellen}>📄 PDF</button>
          {angebot.status !== 'versendet' && angebot.status !== 'angenommen' && (
            <button type="button" className={s.btnPrimary} disabled={wartetFreigabe || sending} onClick={versenden}>
              {sending ? '… sendet' : '✉ Versenden'}
            </button>
          )}
          {darfFreigeben && wartetFreigabe && (
            <>
              <button type="button" className={s.btnApprove} onClick={() => genehmigen(angebot.id, userName)}>✓ Freigeben</button>
              <button type="button" className={s.btnReject} onClick={() => ablehnen(angebot.id, userName)}>✕ Ablehnen</button>
            </>
          )}
          <button type="button" className={s.btnSecondary} onClick={() => setDeleteStep(0)}>🗑 Löschen</button>
        </div>

        {deleteStep !== null && (
          <div
            onClick={() => setDeleteStep(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ek-surface)', borderRadius: 14, padding: 20, maxWidth: 360, width: '100%' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ek-red)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Schritt {deleteStep + 1} von 2
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ek-charcoal)', marginBottom: 8 }}>
                {deleteStep === 0 ? 'Angebot löschen?' : 'Wirklich endgültig löschen?'}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ek-muted)', lineHeight: 1.45, margin: '0 0 16px' }}>
                {deleteStep === 0
                  ? `Angebot ${angebot.nummer} („${angebot.kundeFirma || 'Angebot'}") wird aus den Listen entfernt.`
                  : 'Wirklich fortfahren? Das Angebot verschwindet aus allen Ansichten und kann nicht über die App wiederhergestellt werden.'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setDeleteStep(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--ek-border)', background: 'var(--ek-surface)', fontWeight: 700, cursor: 'pointer' }}>
                  Abbrechen
                </button>
                <button type="button" onClick={() => { if (deleteStep === 0) { setDeleteStep(1); } else { deleteAngebot(angebot.id); onClose(); } }}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#c0392b', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                  {deleteStep === 0 ? 'Weiter →' : 'Ja, endgültig löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {versand && (
          <div className={s.infoCard} style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, color: '#2d8a4e', marginBottom: 6 }}>
              ✓ Versendet{versand.empfaenger ? ` an ${versand.empfaenger}` : ''}{versand.empfaenger ? (versand.mailOk ? ' (Mail zugestellt)' : ' (Mailversand fehlgeschlagen)') : ''}
            </div>
            <div className={s.posLineSub} style={{ marginBottom: 4 }}>Kundenportal-Link:</div>
            <input readOnly value={versand.link} onFocus={e => e.currentTarget.select()}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--ek-border)', fontSize: 12, color: 'var(--ek-charcoal)', background: 'var(--ek-bg)' }} />
          </div>
        )}

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
        </>}
      </div>

      {pdf && (
        <PdfViewer
          dataUrl={pdf.url}
          filename={pdf.name}
          onClose={() => setPdf(null)}
          onDownload={() => downloadDataUrl(pdf.url, pdf.name)}
        />
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

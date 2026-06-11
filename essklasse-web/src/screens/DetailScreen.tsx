import { useState } from 'react';
import { de } from 'date-fns/locale';
import { formatDatum } from '../utils/date';
import type { Bewirtungsbeleg } from '../types';
import { PdfViewer } from '../components/PdfViewer';
import { useBelegStore } from '../store/belegStore';
import s from './DetailScreen.module.css';

interface Props { beleg: Bewirtungsbeleg; onClose: () => void; onAbschliessen?: () => void; onBearbeiten?: () => void; onRechnungErstellen?: (b: Bewirtungsbeleg) => void; canDelete?: boolean; }

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function DetailScreen({ beleg: init, onClose, onAbschliessen, onBearbeiten, onRechnungErstellen, canDelete = true }: Props) {
  const store = useBelegStore();
  const beleg = store.belege.find(b => b.id === init.id) ?? init;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ dataUrl: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | null>(null);

  const datum = formatDatum(beleg.cateringDatumVon, 'dd.MM.yyyy', { locale: de });

  function confirmDelete() { store.deleteBeleg(beleg.id); onClose(); }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.backBtn} onClick={onClose} type="button">← Zurück</button>
        <div className={s.titleWrap}>
          <span className={s.title}>{beleg.veranstaltung || 'Bewirtungsbeleg'}</span>
          {beleg.bestellungsnummer && <span className={s.bestellNr}>{beleg.bestellungsnummer}</span>}
        </div>
        {canDelete && !beleg.abgeschlossen && (
          <button className={s.delBtn} onClick={() => setDeleteStep(0)} type="button">🗑</button>
        )}
      </div>

      {/* Zweistufiger Lösch-Dialog */}
      {deleteStep !== null && (
        <div className={s.modalOverlay} onClick={() => setDeleteStep(null)}>
          <div className={s.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={s.modalStep}>Schritt {deleteStep + 1} von 2</div>
            <div className={s.modalTitle}>
              {deleteStep === 0 ? 'Beleg löschen?' : 'Wirklich endgültig löschen?'}
            </div>
            <div className={s.modalBody}>
              {deleteStep === 0
                ? `„${beleg.veranstaltung || 'Bewirtungsbeleg'}" wird gelöscht. Bitte beachte: Buchhaltung und Bereichsleitung können den gelöschten Beleg weiterhin einsehen und ggf. Rückfragen stellen.`
                : 'Wirklich fortfahren? Der Beleg bleibt für Buchhaltung und Bereichsleitung sichtbar und kann nicht wiederhergestellt werden.'}
            </div>
            <div className={s.modalActions}>
              <button type="button" className={s.cancelBtn} onClick={() => setDeleteStep(null)}>Abbrechen</button>
              <button type="button" className={s.dangerBtn}
                onClick={() => deleteStep === 0 ? setDeleteStep(1) : confirmDelete()}>
                {deleteStep === 0 ? 'Weiter →' : 'Ja, endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={s.scroll}>
        {/* Kopfdaten */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Kopfdaten</div>
          <Row label="Objekt"       value={beleg.objektName} />
          <Row label="Erstellt von" value={beleg.erstelltVon ?? ''} />
          <Row label="Besteller"    value={beleg.besteller} />
          <Row label="Datum"       value={datum} />
          <Row label="Uhrzeit"     value={`${beleg.uhrzeitVon} – ${beleg.uhrzeitBis}`} />
          <Row label="Veranstaltung" value={beleg.veranstaltung} />
          <Row label="Ort / Raum"  value={[beleg.ort, beleg.raum].filter(Boolean).join(' / ')} />
          <Row label="Personen"    value={String(beleg.personenzahl)} />
          <Row label="Konto"       value={beleg.konto} />
          <Row label="Kostenstelle" value={beleg.kostenstelle} />
          <Row label="Kostenträger" value={beleg.kostentraeger} />
        </div>

        {/* Positionen */}
        {beleg.positionen.length > 0 && (() => {
          const gruppen = beleg.positionen.reduce<Record<string, typeof beleg.positionen>>((acc, p) => {
            (acc[p.kategorie] ??= []).push(p);
            return acc;
          }, {});
          return (
            <div className={s.section}>
              <div className={s.posHeader}>
                <div className={s.sectionTitle}>Positionen</div>
                <div className={s.posHeaderAnzahl}>Bestellte Anzahl</div>
              </div>
              {Object.entries(gruppen).map(([kategorie, positionen]) => (
                <div key={kategorie} className={s.posGruppe}>
                  <div className={s.posGruppeTitle}>{kategorie}</div>
                  {positionen.map(p => (
                    <div key={p.id} className={s.posRow}>
                      <div className={s.posName}>{p.bezeichnung}</div>
                      <div className={s.posName}>{p.menge} Stk</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Finaler Bewirtungsbeleg (Abschlussfotos) — oben wenn abgeschlossen */}
        {beleg.abschlussfotos && beleg.abschlussfotos.length > 0 && (
          <div className={`${s.section} ${s.sectionAbschluss}`}>
            <div className={s.sectionTitle}>📋 Finaler Bewirtungsbeleg ({beleg.abschlussfotos.length})</div>
            <div className={s.hinweisRechnung}>ℹ️ Dieser Beleg wird für die Rechnungserstellung verwendet.</div>
            <div className={s.photoGrid}>
              {beleg.abschlussfotos.map((url, i) => (
                <FileThumb
                  key={i}
                  url={url}
                  filename={`${beleg.bestellungsnummer ?? 'beleg'}-abschluss-${i + 1}`}
                  onOpenImage={() => setLightbox(url)}
                  onOpenPdf={() => setPdfViewer({ dataUrl: url, name: `${beleg.bestellungsnummer ?? 'beleg'}-abschluss-${i+1}.pdf` })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bestellfotos (original) */}
        {beleg.fotoDataUrls.length > 0 && (
          <div className={`${s.section} ${s.sectionSmall}`}>
            <div className={s.sectionTitleSmall}>📷 Ursprünglicher Bewirtungsbeleg ({beleg.fotoDataUrls.length})</div>
            <div className={s.photoGridSmall}>
              {beleg.fotoDataUrls.map((url, i) => (
                <FileThumb
                  key={i}
                  url={url}
                  filename={`${beleg.bestellungsnummer ?? 'beleg'}-bestell-${i + 1}`}
                  onOpenImage={() => setLightbox(url)}
                  onOpenPdf={() => setPdfViewer({ dataUrl: url, name: `${beleg.bestellungsnummer ?? 'beleg'}-bestell-${i+1}.pdf` })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Wünsche */}
        {(beleg.wuensche || beleg.interneNotiz) && (
          <div className={s.section}>
            <div className={s.sectionTitle}>Wünsche & Notizen</div>
            {beleg.wuensche && <Row label="Wünsche" value={beleg.wuensche} />}
            {beleg.interneNotiz && <Row label="Interne Notiz" value={beleg.interneNotiz} />}
          </div>
        )}
      </div>

      {/* Abschließen-Button */}
      {onBearbeiten && !beleg.abgeschlossen && (
        <div style={{ padding: '0 16px 8px' }}>
          <button
            type="button"
            onClick={onBearbeiten}
            style={{
              width: '100%', padding: 14, fontSize: 15, fontWeight: 700,
              background: 'var(--ek-surface2)', color: 'var(--ek-charcoal)',
              borderRadius: 12, border: '1.5px solid var(--ek-border)', cursor: 'pointer',
            }}
          >
            ✏️ Bewirtung bearbeiten
          </button>
        </div>
      )}
      {onAbschliessen && !beleg.abgeschlossen && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            type="button"
            onClick={onAbschliessen}
            style={{
              width: '100%', padding: 16, fontSize: 16, fontWeight: 800,
              background: 'linear-gradient(135deg, #2d8a4e, #3aab62)',
              color: '#fff', borderRadius: 14, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,138,78,.3)',
            }}
          >
            ✓ Bewirtung abschließen
          </button>
        </div>
      )}
      {beleg.abgeschlossen && (
        <div style={{
          margin: '0 16px 8px', padding: '12px 16px',
          background: '#e8f5ee', borderRadius: 12,
          border: '1px solid #c3dfc9', color: '#1a5c30',
          fontSize: 13, fontWeight: 700, textAlign: 'center',
        }}>
          ✓ Abgeschlossen {beleg.abgeschlossenVon ? `von ${beleg.abgeschlossenVon}` : ''}
        </div>
      )}
      {/* Buchhaltung: Rechnung erstellen */}
      {onRechnungErstellen && beleg.abgeschlossen && !beleg.rechnungErstellt && (
        <div style={{ padding: '0 16px 8px' }}>
          <button
            type="button"
            onClick={() => onRechnungErstellen(beleg)}
            style={{
              width: '100%', padding: 14, fontSize: 15, fontWeight: 800,
              background: 'linear-gradient(135deg,#2d8a4e,#3aab62)',
              color: '#fff', borderRadius: 12, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,138,78,.3)',
            }}
          >
            🧾 Rechnung erstellen
          </button>
        </div>
      )}
      {beleg.rechnungErstellt && (
        <div style={{
          margin: '0 16px 16px', padding: '12px 16px',
          background: '#d5f5e3', borderRadius: 12,
          border: '1px solid #a9dfbf', color: '#1e8449',
          fontSize: 13, fontWeight: 700,
        }}>
          <div>✅ Rechnung erstellt {beleg.rechnungErstelltVon ? `von ${beleg.rechnungErstelltVon}` : ''}</div>
          {beleg.rechnungsnummer && (
            <div style={{ marginTop: 4, fontSize: 15, letterSpacing: '.5px' }}>🧾 {beleg.rechnungsnummer}</div>
          )}
        </div>
      )}

      {/* PDF-Viewer */}
      {pdfViewer && (
        <PdfViewer
          dataUrl={pdfViewer.dataUrl}
          filename={pdfViewer.name}
          onClose={() => setPdfViewer(null)}
          onDownload={() => downloadDataUrl(pdfViewer.dataUrl, pdfViewer.name)}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className={s.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Vollbild" />
          <button
            type="button"
            className={s.lightboxDownload}
            onClick={e => { e.stopPropagation(); downloadDataUrl(lightbox, 'bewirtungsbeleg.jpg'); }}
            title="Herunterladen"
          >
            ⬇ Herunterladen
          </button>
        </div>
      )}
    </div>
  );
}

function FileThumb({ url, filename, onOpenImage, onOpenPdf }: {
  url: string; filename: string;
  onOpenImage: () => void;
  onOpenPdf: () => void;
}) {
  const isPdf = url.startsWith('data:application/pdf');
  const ext   = isPdf ? 'pdf' : 'jpg';

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    downloadDataUrl(url, `${filename}.${ext}`);
  }

  return (
    <div className={s.thumbWrap}>
      {isPdf ? (
        <div className={s.pdfThumb} onClick={onOpenPdf}>
          <span className={s.pdfIcon}>📄</span>
          <span className={s.pdfLabel}>PDF anzeigen</span>
        </div>
      ) : (
        <img src={url} className={s.photo} onClick={onOpenImage} alt={filename} />
      )}
      <button type="button" className={s.downloadBtn} onClick={handleDownload} title="Herunterladen">
        ⬇
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13, width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

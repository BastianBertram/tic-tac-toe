import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Bewirtungsbeleg } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useBelegStore } from '../store/belegStore';
import s from './DetailScreen.module.css';

interface Props { beleg: Bewirtungsbeleg; onClose: () => void; onAbschliessen?: () => void; }

export function DetailScreen({ beleg: init, onClose, onAbschliessen }: Props) {
  const store = useBelegStore();
  const beleg = store.belege.find(b => b.id === init.id) ?? init;
  const [retrying, setRetrying] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });

  async function retrySync() {
    setRetrying(true);
    store.setSyncStatus(beleg.id, 'syncing');
    try {
      const { createSalesOrder } = await import('../services/bcService');
      const token = (window as any).__bcToken ?? '';
      if (!token) throw new Error('Kein Access Token – bitte zuerst anmelden.');
      const result = await createSalesOrder(beleg, token);
      store.setBcAuftragsnummer(beleg.id, result.auftragsnummer);
    } catch (e: any) {
      store.setSyncStatus(beleg.id, 'error', e?.message);
      alert(e?.message ?? 'Fehler');
    }
    setRetrying(false);
  }

  function del() {
    if (confirm('Beleg wirklich löschen?')) { store.deleteBeleg(beleg.id); onClose(); }
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.backBtn} onClick={onClose} type="button">← Zurück</button>
        <span className={s.title}>{beleg.veranstaltung || 'Bewirtungsbeleg'}</span>
        {!beleg.abgeschlossen && (
          <button className={s.delBtn} onClick={del} type="button">🗑</button>
        )}
      </div>

      <div className={s.scroll}>
        {/* Status */}
        <div className={s.statusRow}>
          <StatusBadge status={beleg.syncStatus} />
          {beleg.bcAuftragsnummer && (
            <span className={s.orderNr}>✅ BC {beleg.bcAuftragsnummer}</span>
          )}
          {(beleg.syncStatus === 'local' || beleg.syncStatus === 'error') && (
            <button className={s.retryBtn} onClick={retrySync} disabled={retrying} type="button">
              {retrying ? '⏳' : '☁️ Erneut senden'}
            </button>
          )}
        </div>
        {beleg.bcFehler && <div className={s.errBox}>⚠️ {beleg.bcFehler}</div>}

        {/* Kopfdaten */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Kopfdaten</div>
          <Row label="Besteller"   value={beleg.besteller} />
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
                      <div className={s.posName}>{p.menge} {p.einheit}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Fotos */}
        {beleg.fotoDataUrls.length > 0 && (
          <div className={s.section}>
            <div className={s.sectionTitle}>Fotos ({beleg.fotoDataUrls.length})</div>
            <div className={s.photoGrid}>
              {beleg.fotoDataUrls.map((url, i) => (
                <img key={i} src={url} className={s.photo}
                  onClick={() => setLightbox(url)} alt={`Foto ${i + 1}`} />
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
          margin: '0 16px 16px', padding: '12px 16px',
          background: '#e8f5ee', borderRadius: 12,
          border: '1px solid #c3dfc9', color: '#1a5c30',
          fontSize: 13, fontWeight: 700, textAlign: 'center',
        }}>
          ✓ Abgeschlossen {beleg.abgeschlossenVon ? `von ${beleg.abgeschlossenVon}` : ''}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className={s.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Vollbild" />
        </div>
      )}
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

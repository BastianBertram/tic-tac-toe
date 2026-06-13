import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Angebot } from '../../types';
import { useAngeboteStore } from '../../store/angeboteStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { euroFull } from './salesUtils';
import { diffSnapshots, aktuellerSnapshot } from '../../services/angebotDiff';
import { generateAngebotPdf } from '../../services/angebotPdf';
import { angebotPdfInput, downloadDataUrl } from './angebotPdfUtils';
import { PdfViewer } from '../../components/PdfViewer';
import s from './AngeboteScreen.module.css';

interface Props { angebot: Angebot; }

const AKTUELL = '__aktuell__';

export function AngebotVersionenTab({ angebot }: Props) {
  const wiederherstellen = useAngeboteStore(st => st.wiederherstellen);
  const darfWiederherstellen = useAuthStore(st => st.isAdmin() || st.isGeschaeftsfuehrung());
  const logoDataUrl = useSettingsStore(st => st.logoDataUrl);
  const impressum   = useSettingsStore(st => st.impressum);
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);

  async function pdfFuerVersion(version: string) {
    const v = angebot.versionen.find(x => x.version === version);
    if (!v) return;
    const url = await generateAngebotPdf(angebotPdfInput(angebot, logoDataUrl, impressum, v.snapshot, `v${version}`));
    setPdf({ url, name: `Angebot_${angebot.nummer}_v${version}.pdf` });
  }

  // Auswahlmöglichkeiten: alle Versionen + der aktuelle (ungespeicherte) Stand.
  const optionen = useMemo(() => {
    const vers = angebot.versionen.map(v => ({ key: v.version, label: `v${v.version}`, snap: v.snapshot }));
    return [...vers, { key: AKTUELL, label: 'Aktuell', snap: aktuellerSnapshot(angebot) }];
  }, [angebot]);

  const letzteVersion = angebot.versionen.length ? angebot.versionen[angebot.versionen.length - 1].version : AKTUELL;
  const [aKey, setAKey] = useState<string>(letzteVersion);
  const [bKey, setBKey] = useState<string>(AKTUELL);

  const snapA = optionen.find(o => o.key === aKey)?.snap;
  const snapB = optionen.find(o => o.key === bKey)?.snap;
  const diff = snapA && snapB ? diffSnapshots(snapA, snapB) : null;

  function restore(version: string) {
    if (!darfWiederherstellen) return;
    if (window.confirm(`Version ${version} wiederherstellen? Der aktuelle Stand wird überschrieben.`)) {
      wiederherstellen(angebot.id, version);
    }
  }

  const fmtVal = (v: string, geld?: boolean) => geld ? euroFull(Number(v)) : v;

  return (
    <div>
      {/* Versionsliste */}
      <div className={s.sectionLabel}>Versionen ({angebot.versionen.length})</div>
      {angebot.versionen.length === 0 && (
        <div className={s.diffEmpty}>Noch keine Versionen gespeichert. In der Übersicht „+ Version" anlegen.</div>
      )}
      {angebot.versionen.length > 0 && (
        <div className={s.infoCard}>
          {[...angebot.versionen].reverse().map(v => (
            <div key={v.version} className={s.versRow}>
              <span className={s.versNr}>v{v.version}</span>
              <div className={s.versMeta}>
                <div className={s.versMetaTop}>{euroFull(v.snapshot.gesamtsumme)}{v.aenderung ? ` · ${v.aenderung}` : ''}</div>
                <div className={s.versMetaSub}>
                  {format(parseISO(v.erstelltAm), 'dd.MM.yyyy HH:mm', { locale: de })}{v.erstelltVon ? ` · ${v.erstelltVon}` : ''}
                </div>
              </div>
              <button type="button" className={s.versRestore} onClick={() => pdfFuerVersion(v.version)}>📄 PDF</button>
              {darfWiederherstellen && (
                <button type="button" className={s.versRestore} onClick={() => restore(v.version)}>↺</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diff */}
      <div className={s.sectionLabel}>Vergleich</div>
      <div className={s.diffPick}>
        <select className={s.diffSelect} value={aKey} onChange={e => setAKey(e.target.value)}>
          {optionen.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <span className={s.diffArrow}>→</span>
        <select className={s.diffSelect} value={bKey} onChange={e => setBKey(e.target.value)}>
          {optionen.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {!diff && <div className={s.diffEmpty}>Zwei Stände zum Vergleich wählen.</div>}
      {diff && diff.gleich && <div className={s.diffEmpty}>Keine Unterschiede.</div>}
      {diff && !diff.gleich && (
        <div className={s.infoCard}>
          {diff.felder.map(f => (
            <div key={f.feld} className={s.diffField}>
              <div className={s.diffLabel}>{f.label}</div>
              <div className={s.diffVals}>
                <span className={s.diffOld}>{fmtVal(f.alt, f.geld) || '—'}</span>
                <span className={s.diffArrow}>→</span>
                <span className={s.diffNew}>{fmtVal(f.neu, f.geld) || '—'}</span>
              </div>
            </div>
          ))}
          {diff.positionen.map(p => (
            <div key={p.id} className={s.diffField}>
              <div className={s.diffVals}>
                <span className={`${s.diffTag} ${p.art === 'added' ? s.diffTagAdd : p.art === 'removed' ? s.diffTagDel : s.diffTagChg}`}>
                  {p.art === 'added' ? 'Neu' : p.art === 'removed' ? 'Entfernt' : 'Geändert'}
                </span>
                <span className={s.diffLabel} style={{ textTransform: 'none' }}>{p.bezeichnung || '—'}</span>
              </div>
              {p.art === 'changed' && p.felder.map(f => (
                <div key={f.feld} className={s.diffVals} style={{ marginTop: 4, paddingLeft: 4 }}>
                  <span className={s.diffLabel} style={{ textTransform: 'none' }}>{f.label}:</span>
                  <span className={s.diffOld}>{fmtVal(f.alt, f.geld) || '—'}</span>
                  <span className={s.diffArrow}>→</span>
                  <span className={s.diffNew}>{fmtVal(f.neu, f.geld) || '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

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

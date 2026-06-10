import { useRef, useState } from 'react';
import { extractFromPhoto, type ExtractedBeleg } from '../services/ocrService';
import s from './PhotoCapture.module.css';

interface Props {
  dataUrls: string[];
  onChange: (urls: string[]) => void;
  onExtracted?: (data: ExtractedBeleg) => void;
  label?: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function PhotoCapture({ dataUrls, onChange, onExtracted, label = '📷 Bewirtungsbeleg *' }: Props) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).map(fileToDataUrl));
    const newUrls = [...dataUrls, ...urls];
    onChange(newUrls);

    // Trigger OCR on the first new photo
    if (onExtracted && urls.length > 0) {
      await runOcr(urls[0]);
    }
  }

  async function runOcr(dataUrl: string) {
    setScanning(true);
    setScanMsg('📋 Beleg wird gelesen …');
    try {
      const extracted = await extractFromPhoto(dataUrl);
      onExtracted?.(extracted);
      setScanMsg('✅ Felder erfolgreich übernommen!');
      setTimeout(() => setScanMsg(''), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'AI_NOT_CONFIGURED') {
        setScanMsg('ℹ️ KI-Auslesen ist serverseitig nicht aktiviert — bitte Daten manuell eintragen.');
      } else {
        const isQuota = msg.includes('529') || msg.includes('credit') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('balance') || msg.includes('rate') || msg.includes('overloaded');
        if (isQuota) {
          setScanMsg('❌ KI-Budget aufgebraucht — Bitte Daten manuell eintragen.');
        } else {
          setScanMsg(`⚠️ Beleg konnte nicht gescannt werden — bitte Daten manuell eintragen. (${msg})`);
        }
      }
      setTimeout(() => setScanMsg(''), 8000);
    } finally {
      setScanning(false);
    }
  }

  function remove(idx: number) {
    onChange(dataUrls.filter((_, i) => i !== idx));
  }

  return (
    <div
      className={`${s.wrapper} ${dragOver ? s.wrapperDrag : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className={s.label}>{label}</div>

      {dragOver && (
        <div className={s.dropOverlay}>
          <span className={s.dropIcon}>📄</span>
          <span className={s.dropText}>Datei hier ablegen</span>
        </div>
      )}

      {/* Primärer Kamera-Button */}
      <button
        className={s.cameraBtn}
        onClick={() => cameraRef.current?.click()}
        type="button"
        disabled={scanning}
      >
        {scanning ? (
          <>
            <span className={s.camIcon}>⏳</span>
            <span className={s.camText}>Beleg wird analysiert …</span>
            <span className={s.camSub}>KI liest Felder aus</span>
          </>
        ) : (
          <>
            <span className={s.camIcon}>📸</span>
            <span className={s.camText}>Foto aufnehmen</span>
            <span className={s.camSub}>Felder werden automatisch erkannt</span>
          </>
        )}
      </button>
      <input
        ref={cameraRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} multiple={false}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Galerie + PDF Button */}
      <button
        className={s.galleryBtn}
        onClick={() => galleryRef.current?.click()}
        type="button"
        disabled={scanning}
      >
        🖼️ Aus Galerie oder PDF wählen
      </button>
      <input
        ref={galleryRef} type="file" accept="image/*,application/pdf"
        style={{ display: 'none' }} multiple
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Drag-and-Drop Hinweis */}
      {!scanning && (
        <div className={s.dropHint}>
          <span className={s.dropHintIcon}>📎</span>
          Bild oder PDF hier reinziehen
        </div>
      )}

      {/* Scan-Status */}
      {scanMsg && (
        <div className={`${s.scanMsg} ${scanMsg.startsWith('✅') ? s.scanOk : scanMsg.startsWith('⚠️') ? s.scanErr : s.scanInfo}`}>
          {scanMsg}
        </div>
      )}

      {/* Vorschau-Thumbnails */}
      {dataUrls.length > 0 ? (
        <div className={s.thumbRow}>
          {dataUrls.map((url, i) => {
            const isPdf = url.startsWith('data:application/pdf');
            return (
              <div key={i} className={s.thumbWrap}>
                {isPdf ? (
                  <div className={s.pdfThumb}>📄</div>
                ) : (
                  <img src={url} className={s.thumb} alt={`Foto ${i + 1}`} />
                )}
                <button className={s.removeBtn} onClick={() => remove(i)} type="button" title="Löschen">✕</button>
                {onExtracted && i > 0 && !isPdf && (
                  <button className={s.rescanBtn} onClick={() => runOcr(url)} type="button" title="Felder aus diesem Foto lesen">
                    🔍
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className={s.hint}>Noch keine Fotos – Felder werden nach dem Fotografieren automatisch ausgefüllt.</p>
      )}
    </div>
  );
}

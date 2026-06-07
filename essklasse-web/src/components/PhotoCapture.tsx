import { useRef, useState } from 'react';
import { extractFromPhoto, getApiKey, setApiKey, type ExtractedBeleg } from '../services/ocrService';
import s from './PhotoCapture.module.css';

interface Props {
  dataUrls: string[];
  onChange: (urls: string[]) => void;
  onExtracted?: (data: ExtractedBeleg) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function PhotoCapture({ dataUrls, onChange, onExtracted }: Props) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');

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
    const key = getApiKey();
    if (!key) {
      setShowKeyModal(true);
      return;
    }
    setScanning(true);
    setScanMsg('📋 Beleg wird gelesen …');
    try {
      const extracted = await extractFromPhoto(dataUrl);
      onExtracted?.(extracted);
      setScanMsg('✅ Felder erfolgreich übernommen!');
      setTimeout(() => setScanMsg(''), 3000);
    } catch (e: any) {
      if (e?.message === 'NO_KEY') {
        setShowKeyModal(true);
      } else {
        setScanMsg(`⚠️ ${e?.message ?? 'Fehler beim Lesen'}`);
        setTimeout(() => setScanMsg(''), 5000);
      }
    } finally {
      setScanning(false);
    }
  }

  function saveKey() {
    if (!keyInput.trim()) return;
    setApiKey(keyInput.trim());
    setShowKeyModal(false);
    setScanMsg('🔑 API-Key gespeichert. Bitte Foto erneut aufnehmen.');
    setTimeout(() => setScanMsg(''), 4000);
  }

  function remove(idx: number) {
    onChange(dataUrls.filter((_, i) => i !== idx));
  }

  return (
    <div className={s.wrapper}>
      <div className={s.label}>📷 Bewirtungsbeleg *</div>

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

      {/* API-Key Modal */}
      {showKeyModal && (
        <div className={s.overlay} onClick={() => setShowKeyModal(false)}>
          <div className={s.keyModal} onClick={e => e.stopPropagation()}>
            <div className={s.keyModalTitle}>🔑 Anthropic API-Key einrichten</div>
            <p className={s.keyModalText}>
              Für die automatische Felderkennung wird ein Anthropic API-Key benötigt.
              Der Key wird nur lokal in diesem Browser gespeichert.
            </p>
            <input
              className={s.keyInput}
              type="password"
              placeholder="sk-ant-..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              autoFocus
            />
            <div className={s.keyModalBtns}>
              <button className={s.keyCancel} onClick={() => setShowKeyModal(false)} type="button">
                Überspringen
              </button>
              <button className={s.keySave} onClick={saveKey} type="button">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

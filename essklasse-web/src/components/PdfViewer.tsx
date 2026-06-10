import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import s from './PdfViewer.module.css';

// Worker als separaten Chunk laden (Vite erkennt den Import automatisch)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  dataUrl: string;
  filename: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PdfViewer({ dataUrl, filename, onClose, onDownload }: Props) {
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      try {
        setLoading(true);
        setError(null);

        // data URL → Uint8Array
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        const canvases: HTMLCanvasElement[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

          const viewport = page.getViewport({ scale: 2.0 }); // Retina-Qualität
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.display = 'block';

          const ctx = canvas.getContext('2d')!;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;

          canvases.push(canvas);
        }

        setPages(canvases);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'PDF konnte nicht geladen werden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderPdf();
    return () => { cancelled = true; };
  }, [dataUrl]);

  // Canvas-Elemente in den Container einhängen
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return;
    containerRef.current.innerHTML = '';
    pages.forEach(c => containerRef.current!.appendChild(c));
  }, [pages]);

  return (
    <div className={s.overlay}>
      <div className={s.toolbar}>
        <span className={s.title}>📄 {filename}</span>
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={onDownload}>⬇ Herunterladen</button>
          <button type="button" className={s.btn} onClick={onClose}>✕ Schließen</button>
        </div>
      </div>

      <div className={s.scroll}>
        {loading && (
          <div className={s.state}>
            <div className={s.spinner} />
            <p>PDF wird geladen …</p>
          </div>
        )}
        {error && (
          <div className={s.state}>
            <p className={s.errorMsg}>⚠️ {error}</p>
            <button type="button" className={s.btn} onClick={onDownload}>
              ⬇ Als Datei herunterladen
            </button>
          </div>
        )}
        {!loading && !error && (
          <div ref={containerRef} className={s.pages} />
        )}
      </div>
    </div>
  );
}

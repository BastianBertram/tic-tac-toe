/**
 * Erzeugt ein Angebots-PDF (data-URL) aus einem Angebot bzw. einem Versions-
 * Snapshot — ohne externe Abhängigkeit, auf Basis der gemeinsamen PDF-Primitive
 * aus belegPdf.ts (WinAnsi-Helvetica, Logo via DCTDecode, mehrseitig).
 *
 * Aufbau: Logo + Firmenkopf, Angebotsnummer, Kundenblock, Betreff/Gültigkeit,
 * Einleitung, Positionstabelle (Bezeichnung/Menge/Einheit/Einzelpreis/Rabatt/
 * Gesamt), Summenblock (Netto/Rabatt/Endpreis), Bedingungen, Impressum-Fuß.
 */
import type { AngebotPosition } from '../types';
import type { Impressum } from '../store/settingsStore';
import {
  PAGE_W, PAGE_H, MARGIN, BOTTOM,
  esc, textWidth, trunc, wrap, prepareLogo, buildPdf, type LogoImg,
} from './belegPdf';

export interface AngebotPdfInput {
  nummer: string;
  kundeFirma: string;
  ansprechpartner?: string;
  email?: string;
  telefon?: string;
  betreff: string;
  einleitung?: string;
  zahlungsbedingungen?: string;
  lieferbedingungen?: string;
  gueltigBis?: string;
  positionen: AngebotPosition[];
  rabattGesamtProzent?: number;
  gesamtsumme: number;
  /** Versionsangabe (z.B. "v1.2") — erscheint im Kopf, wenn gesetzt. */
  versionLabel?: string;
  logoDataUrl?: string | null;
  impressum?: Impressum | null;
}

const euro = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

function fmtDatum(v?: string): string {
  if (!v) return '–';
  const [yr, m, d] = v.split('-');
  return d && m && yr ? `${d}.${m}.${yr}` : v;
}

export async function generateAngebotPdf(b: AngebotPdfInput): Promise<string> {
  const logo = b.logoDataUrl ? await prepareLogo(b.logoDataUrl) : null;

  const pages: string[] = [];
  let stream = '';
  let y = PAGE_H - MARGIN;
  const flush = () => { pages.push(stream); stream = ''; y = PAGE_H - MARGIN; };

  const txt = (x: number, yy: number, s: string, size: number, bold = false) => {
    stream += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${esc(s)}) Tj ET\n`;
  };
  const txtRight = (xr: number, yy: number, s: string, size: number, bold = false) =>
    txt(xr - textWidth(s, size, bold), yy, s, size, bold);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) => {
    stream += `${w} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  };

  // ── Logo oben rechts (Seite 1) ──
  if (logo) {
    const maxW = 130, maxH = 42;
    const scale = Math.min(maxW / logo.w, maxH / logo.h, 1);
    const dw = logo.w * scale, dh = logo.h * scale;
    const ix = PAGE_W - MARGIN - dw;
    const iy = PAGE_H - MARGIN - dh + 8;
    stream += `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q\n`;
  }

  // ── Kopf ──
  txt(MARGIN, y, 'Angebot', 20, true);
  y -= 26;
  txt(MARGIN, y, `Angebotsnummer: ${b.nummer}${b.versionLabel ? `  (${b.versionLabel})` : ''}`, 12, true);
  y -= 16;
  txt(MARGIN, y, `Datum: ${fmtDatum(new Date().toISOString().slice(0, 10))}`, 9);
  if (b.gueltigBis) { y -= 12; txt(MARGIN, y, `Gültig bis: ${fmtDatum(b.gueltigBis)}`, 9); }
  y -= 24;

  // ── Kundenblock ──
  txt(MARGIN, y, b.kundeFirma || '–', 12, true);
  y -= 15;
  for (const [label, value] of [
    ['z. Hd.', b.ansprechpartner], ['E-Mail', b.email], ['Telefon', b.telefon],
  ] as [string, string | undefined][]) {
    if (!value) continue;
    txt(MARGIN, y, `${label}: ${value}`, 9);
    y -= 12;
  }
  y -= 12;

  // ── Betreff ──
  txt(MARGIN, y, `Betreff: ${b.betreff || '–'}`, 12, true);
  y -= 20;

  // ── Einleitung ──
  if (b.einleitung?.trim()) {
    for (const part of wrap(b.einleitung.trim(), 95)) {
      if (y < BOTTOM) flush();
      txt(MARGIN, y, part, 10); y -= 14;
    }
    y -= 8;
  }

  // ── Positionstabelle ──
  const L = MARGIN, R = 545;
  const xName = L;
  const xMengeR = 320;   // rechte Kante Menge
  const xEinheit = 326;  // linke Kante Einheit
  const xEinzelR = 440;  // rechte Kante Einzelpreis
  const xRabattR = 495;  // rechte Kante Rabatt
  const ROW_H = 16, HEADER_H = 18;

  const drawHeader = () => {
    const hT = y, hB = y - HEADER_H, base = hT - 12;
    line(L, hT, R, hT, 0.8);
    line(L, hB, R, hB, 0.8);
    txt(xName + 2, base, 'Bezeichnung', 8, true);
    txtRight(xMengeR, base, 'Menge', 8, true);
    txt(xEinheit, base, 'Einh.', 8, true);
    txtRight(xEinzelR, base, 'Einzel', 8, true);
    txtRight(xRabattR, base, 'Rab.%', 8, true);
    txtRight(R - 2, base, 'Gesamt', 8, true);
    y = hB;
  };

  const drawRow = (p: AngebotPosition) => {
    if (y - ROW_H < BOTTOM) { flush(); drawHeader(); }
    const base = y - 12;
    txt(xName + 2, base, trunc(p.bezeichnung || '–', 38), 9);
    txtRight(xMengeR, base, String(p.menge), 9);
    txt(xEinheit, base, trunc(p.einheit, 8), 9);
    txtRight(xEinzelR, base, euro(p.einzelpreis), 9);
    txtRight(xRabattR, base, p.rabattProzent ? `${p.rabattProzent}%` : '–', 9);
    txtRight(R - 2, base, euro(p.gesamt), 9);
    line(L, y - ROW_H, R, y - ROW_H, 0.3);
    y -= ROW_H;
  };

  const aktive = b.positionen.filter(p => !p.geloescht);
  if (y - HEADER_H - ROW_H < BOTTOM) flush();
  drawHeader();
  for (const p of aktive) drawRow(p);

  // ── Summenblock ──
  const netto = aktive.reduce((sum, p) => sum + p.gesamt, 0);
  y -= 8;
  const sumLine = (label: string, value: string, bold = false, size = 10) => {
    if (y < BOTTOM) flush();
    txtRight(xEinzelR, y, label, size, bold);
    txtRight(R - 2, y, value, size, bold);
    y -= bold ? 18 : 14;
  };
  sumLine('Netto-Summe', euro(netto));
  if (b.rabattGesamtProzent) {
    sumLine(`Gesamtrabatt ${b.rabattGesamtProzent}%`, '- ' + euro(netto - b.gesamtsumme));
  }
  line(xEinzelR - 40, y + 4, R, y + 4, 0.6);
  sumLine('Endpreis (netto)', euro(b.gesamtsumme), true, 12);

  // ── Bedingungen ──
  y -= 10;
  for (const [label, value] of [
    ['Zahlungsbedingungen', b.zahlungsbedingungen], ['Lieferbedingungen', b.lieferbedingungen],
  ] as [string, string | undefined][]) {
    if (!value?.trim()) continue;
    if (y < BOTTOM + 14) flush();
    txt(MARGIN, y, `${label}:`, 9, true); y -= 12;
    for (const part of wrap(value.trim(), 100)) { if (y < BOTTOM) flush(); txt(MARGIN, y, part, 9); y -= 12; }
    y -= 4;
  }

  flush();

  // ── Fußzeile: Impressum + Seitenzahl auf jeder Seite ──
  const imp = b.impressum;
  const impLine = imp
    ? [
        imp.geschaeftsfuehrung?.filter(Boolean).length ? `GF: ${imp.geschaeftsfuehrung.filter(Boolean).join(', ')}` : '',
        [imp.strasse, imp.hausnummer].filter(Boolean).join(' '),
        [imp.plz, imp.ort].filter(Boolean).join(' '),
        imp.umsatzsteuerId ? `USt-IdNr.: ${imp.umsatzsteuerId}` : '',
      ].filter(Boolean).join(' · ')
    : '';
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    if (impLine) {
      pages[i] += `BT /F1 7 Tf ${MARGIN.toFixed(2)} 42 Td (${esc(impLine)}) Tj ET\n`;
    }
    const label = `Seite ${i + 1} von ${total}`;
    const fx = PAGE_W - MARGIN - textWidth(label, 8, false);
    pages[i] += `BT /F1 8 Tf ${fx.toFixed(2)} 30 Td (${esc(label)}) Tj ET\n`;
  }

  return buildPdf(pages, logo as LogoImg | null);
}

/**
 * Erzeugt einen Ersatz-Bewirtungsbeleg als PDF (data-URL) aus den erfassten
 * Bestelldaten + Positionen — ohne externe Abhängigkeit.
 *
 * Aufbau wie der Original-Bewirtungsschein: Positionstabelle mit Rasterlinien
 * (Bezeichnung, Bestellt, Ausgeliefert, Zurück [Voll|Leer], Berechnen, Pfand),
 * dem im Admin-Bereich hinterlegten Logo oben rechts und Unterschriftsfeldern
 * (Name in Druckschrift + Unterschrift) am Ende.
 *
 * Text nutzt WinAnsi-Encoding (Helvetica), damit deutsche Umlaute korrekt
 * dargestellt werden. Das Logo wird über ein Canvas nach JPEG konvertiert und
 * als DCTDecode-Image eingebettet.
 */
import type { BelegPosition } from '../types';

export interface ErsatzBelegInput {
  objektName: string;
  besteller: string;
  veranstaltung: string;
  cateringDatumVon: string;
  cateringDatumBis: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  ort: string;
  raum: string;
  personenzahl: number;
  konto?: string;
  kostenstelle?: string;
  kostentraeger?: string;
  wuensche?: string;
  rechnungsanschriftFirma?: string;
  rechnungsanschriftZuHaenden?: string;
  rechnungsanschriftStrasse?: string;
  rechnungsanschriftPlzOrt?: string;
  rechnungsanschriftAnlass?: string;
  rechnungsanschriftTeilnehmer?: string;
  rechnungsanschriftTelefon?: string;
  positionen: BelegPosition[];
  /** Im Admin-Bereich hinterlegtes Logo (data-URL) — oben rechts im PDF. */
  logoDataUrl?: string | null;
  /** @deprecated nicht mehr verwendet (Spalten folgen dem Bewirtungsschein). */
  showPreise?: boolean;
}

// ── Seiten-Geometrie (A4 in PDF-Punkten) ──
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const BOTTOM = 70;

// Typografische Sonderzeichen → WinAnsi (CP1252) Code-Punkte.
const WINANSI_SPECIAL: Record<number, number> = {
  0x20ac: 0x80, 0x2026: 0x85, 0x2013: 0x96, 0x2014: 0x97,
  0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
};

/** Escaped Text für PDF-Literale: ( ) \ schützen, Umlaute als WinAnsi-Oktal. */
function esc(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else if (WINANSI_SPECIAL[code]) out += '\\' + WINANSI_SPECIAL[code].toString(8).padStart(3, '0');
    else if (code >= 0xa0 && code <= 0xff) out += '\\' + code.toString(8).padStart(3, '0');
    else out += '?';
  }
  return out;
}

/** Grobe Helvetica-Textbreite zur Zentrierung kurzer Texte. */
function textWidth(s: string, size: number, bold: boolean): number {
  return s.length * size * (bold ? 0.56 : 0.52);
}

function trunc(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** Bricht langen Text in Zeilen fester Zeichenbreite um. */
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

interface LogoImg { base64: string; w: number; h: number; }

/** Lädt das Logo, legt es auf weißen Grund und konvertiert nach JPEG. */
async function prepareLogo(dataUrl: string): Promise<LogoImg | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext('2d');
    if (!cx) return null;
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, w, h);
    cx.drawImage(img, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1] ?? '';
    return base64 ? { base64, w, h } : null;
  } catch {
    return null;
  }
}

export async function generateErsatzBelegPdf(b: ErsatzBelegInput): Promise<string> {
  const logo = b.logoDataUrl ? await prepareLogo(b.logoDataUrl) : null;

  // ── Zeichen-Kontext (mehrseitig) ──
  const pages: string[] = [];
  let stream = '';
  let y = PAGE_H - MARGIN;

  const flush = () => { pages.push(stream); stream = ''; y = PAGE_H - MARGIN; };

  const txt = (x: number, yy: number, s: string, size: number, bold = false) => {
    stream += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${esc(s)}) Tj ET\n`;
  };
  const txtCenter = (xc: number, yy: number, s: string, size: number, bold = false) =>
    txt(xc - textWidth(s, size, bold) / 2, yy, s, size, bold);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) => {
    stream += `${w} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  };
  const rect = (x: number, yy: number, w: number, h: number, sw = 0.6) => {
    stream += `${sw} w ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
  };

  const fmtDatum = (v: string) => {
    if (!v) return '–';
    const [yr, m, d] = v.split('-');
    return d && m && yr ? `${d}.${m}.${yr}` : v;
  };
  const zeitraum = b.cateringDatumVon === b.cateringDatumBis
    ? fmtDatum(b.cateringDatumVon)
    : `${fmtDatum(b.cateringDatumVon)} – ${fmtDatum(b.cateringDatumBis)}`;
  const uhrzeit = [b.uhrzeitVon, b.uhrzeitBis].filter(Boolean).join(' – ') || '–';

  // ── Logo oben rechts (nur Seite 1) ──
  if (logo) {
    const maxW = 130, maxH = 42;
    const scale = Math.min(maxW / logo.w, maxH / logo.h, 1);
    const dw = logo.w * scale, dh = logo.h * scale;
    const ix = PAGE_W - MARGIN - dw;
    const iy = PAGE_H - MARGIN - dh + 8;
    stream += `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q\n`;
  }

  // ── Kopf ──
  txt(MARGIN, y, 'Ersatz-Bewirtungsbeleg', 18, true);
  y -= 26;
  txt(MARGIN, y, 'Maschinell erstellt aus den erfassten Bestelldaten (kein Original-Beleg hochgeladen).', 9);
  y -= 13;
  txt(MARGIN, y, `Objekt: ${b.objektName || '–'}`, 9);
  y -= 30;

  // ── Abschnitt-Helfer ──
  const sectionTitle = (label: string) => {
    if (y < BOTTOM + 30) flush();
    txt(MARGIN, y, label, 13, true);
    y -= 16;
  };
  const field = (label: string, value: string) => {
    if (!value) return;
    if (y < BOTTOM) flush();
    txt(MARGIN, y, label + ':', 11, false);
    txt(MARGIN + 170, y, value, 11, false);
    y -= 16;
  };
  // Eine Abschnitts-Spalte (Titel + Label/Wert-Zeilen) ab startY; Rückgabe = End-Y.
  const drawColumn = (colX: number, colRight: number, startY: number, title: string, rows: [string, string][]): number => {
    let cy = startY;
    txt(colX, cy, title, 12, true);
    cy -= 16;
    for (const [label, value] of rows) {
      if (!value) continue;
      const labelStr = label + ': ';
      const lw = textWidth(labelStr, 9, false);
      txt(colX, cy, labelStr, 9, false);
      const maxChars = Math.floor((colRight - colX - lw) / (9 * 0.52));
      if (value.length <= maxChars) {
        txt(colX + lw, cy, value, 9, false);
        cy -= 14;
      } else {
        // Wert passt nicht neben das Label → eingerückt darunter umbrechen.
        cy -= 12;
        const wrapChars = Math.max(8, Math.floor((colRight - colX - 10) / (9 * 0.52)));
        for (const part of wrap(value, wrapChars)) { txt(colX + 10, cy, part, 9, false); cy -= 12; }
        cy -= 2;
      }
    }
    return cy;
  };

  // ── Bestelldaten (links) & Rechnungsanschrift (rechts) nebeneinander ──
  const colTop = y;
  const leftRows: [string, string][] = [
    ['Besteller', b.besteller],
    ['Veranstaltung', b.veranstaltung],
    ['Datum', zeitraum],
    ['Uhrzeit', uhrzeit],
    ['Ort', b.ort],
    ['Raum', b.raum],
    ['Personenzahl', String(b.personenzahl || 0)],
  ];
  const rightRows: [string, string][] = [
    ['Firma', b.rechnungsanschriftFirma ?? ''],
    ['Zu Händen', b.rechnungsanschriftZuHaenden ?? ''],
    ['Straße / Nr.', b.rechnungsanschriftStrasse ?? ''],
    ['PLZ / Ort', b.rechnungsanschriftPlzOrt ?? ''],
    ['Anlass', b.rechnungsanschriftAnlass ?? ''],
    ['Teilnehmer', b.rechnungsanschriftTeilnehmer ?? ''],
    ['Telefonnummer für Rückfragen', b.rechnungsanschriftTelefon ?? ''],
  ];
  const leftEnd = drawColumn(MARGIN, 292, colTop, 'Bestelldaten', leftRows);
  const rightEnd = drawColumn(312, 545, colTop, 'Rechnungsanschrift', rightRows);
  y = Math.min(leftEnd, rightEnd);

  if (b.konto || b.kostenstelle || b.kostentraeger) {
    y -= 12; sectionTitle('Kostenzuordnung');
    field('Konto', b.konto ?? '');
    field('Kostenstelle', b.kostenstelle ?? '');
    field('Kostenträger', b.kostentraeger ?? '');
  }

  // ── Positionstabelle mit Raster (wie Original-Bewirtungsschein) ──
  y -= 14;
  sectionTitle('Positionen / Leistungen');
  y -= 4;

  // Spalten: [links, breite]. Summe = 495 (50..545)
  const L = MARGIN;            // 50
  const xName = L;             // Bezeichnung
  const xBestellt = 225;
  const xAusgel = 280;
  const xVoll = 340;
  const xLeer = 382;
  const xBerechnen = 424;
  const xPfand = 486;
  const R = 545;              // rechter Rand
  const vlines = [xBestellt, xAusgel, xVoll, xLeer, xBerechnen, xPfand]; // innere Trennlinien (Body)
  const HEADER_H = 26;
  const ROW_H = 16;

  const drawTableHeader = () => {
    const hT = y;
    const hMid = hT - 13;
    const hBot = hT - HEADER_H;
    // Rahmen oben/unten
    line(L, hT, R, hT, 0.8);
    line(L, hBot, R, hBot, 0.8);
    // Vertikale Linien (volle Höhe), außer Voll/Leer-Trenner nur untere Hälfte
    for (const x of [L, xBestellt, xAusgel, xVoll, xBerechnen, xPfand, R]) line(x, hT, x, hBot);
    line(xLeer, hMid, xLeer, hBot);               // Trenner Voll|Leer nur unten
    line(xVoll, hMid, xBerechnen, hMid);          // Trenner unter "Zurück"
    // Beschriftungen
    txt(xName + 4, hMid - 3, 'Bezeichnung', 7.5, true);
    txtCenter((xBestellt + xAusgel) / 2, hMid - 3, 'Bestellt', 7.5, true);
    txtCenter((xAusgel + xVoll) / 2, hMid - 3, 'Ausgeliefert', 7.5, true);
    txtCenter((xVoll + xBerechnen) / 2, hT - 9, 'Zurück', 7.5, true);
    txtCenter((xVoll + xLeer) / 2, hBot + 5, 'Voll', 7.5, true);
    txtCenter((xLeer + xBerechnen) / 2, hBot + 5, 'Leer', 7.5, true);
    txtCenter((xBerechnen + xPfand) / 2, hMid - 3, 'Berechnen', 7.5, true);
    txtCenter((xPfand + R) / 2, hMid - 3, 'Pfand', 7.5, true);
    y = hBot;
  };

  const drawPosRow = (p: BelegPosition) => {
    if (y - ROW_H < BOTTOM) { flush(); drawTableHeader(); }
    const top = y, bot = y - ROW_H, base = y - 11;
    for (const x of [L, ...vlines, R]) line(x, top, x, bot);
    line(L, bot, R, bot);
    txt(xName + 4, base, trunc(p.bezeichnung, 30), 9, false);
    txtCenter((xBestellt + xAusgel) / 2, base, String(p.menge), 9, false);
    y = bot;
  };

  const drawKatBand = (kat: string) => {
    if (y - ROW_H < BOTTOM) { flush(); drawTableHeader(); }
    const top = y, bot = y - ROW_H, base = y - 11;
    line(L, top, L, bot); line(R, top, R, bot);   // nur äußere Ränder (zusammengeführt)
    line(L, bot, R, bot);
    txt(xName + 4, base, kat, 9.5, true);
    y = bot;
  };

  drawTableHeader();
  let lastKat = '';
  for (const p of b.positionen) {
    if (p.kategorie !== lastKat) { drawKatBand(String(p.kategorie)); lastKat = p.kategorie; }
    drawPosRow(p);
  }

  // ── Wünsche / Hinweise ──
  if (b.wuensche?.trim()) {
    y -= 28; sectionTitle('Wünsche / Hinweise');
    for (const part of wrap(b.wuensche.trim(), 95)) {
      if (y < BOTTOM) flush();
      txt(MARGIN, y, part, 10, false); y -= 14;
    }
  }

  // ── Unterschriftsfelder (Mitarbeiter) ──
  const SIG_BLOCK = 96;
  if (y - SIG_BLOCK < BOTTOM) flush();
  y -= 34;
  txt(MARGIN, y, 'Bestätigung Mitarbeiter', 12, true);
  y -= 22;
  const boxW = 230, boxH = 40, gap = 35;
  const leftX = MARGIN, rightX = MARGIN + boxW + gap;
  txt(leftX, y, 'Name (in Druckschrift)', 9, false);
  txt(rightX, y, 'Unterschrift', 9, false);
  rect(leftX, y - 8 - boxH, boxW, boxH);
  rect(rightX, y - 8 - boxH, boxW, boxH);
  y -= 8 + boxH;

  // ── Fußzeile ──
  y -= 22;
  if (y < BOTTOM) flush();
  txt(MARGIN, y, `Erstellt am ${new Date().toLocaleString('de-DE')}`, 8, false);

  flush();

  return buildPdf(pages, logo);
}

/** Baut aus den Seiten-Streams ein PDF (optional mit eingebettetem Logo). */
function buildPdf(pages: string[], logo: LogoImg | null): string {
  const objects: string[] = [];
  const CATALOG = 1, PAGES = 2, F1 = 3, F2 = 4;
  const IMG = logo ? 5 : 0;
  const firstPage = logo ? 6 : 5;
  const pageCount = pages.length;

  const kids: string[] = [];
  for (let i = 0; i < pageCount; i++) kids.push(`${firstPage + i * 2} 0 R`);

  objects[CATALOG] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[PAGES] = `<< /Type /Pages /Count ${pageCount} /Kids [${kids.join(' ')}] >>`;
  objects[F1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[F2] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  if (logo) {
    const bin = atob(logo.base64);
    objects[IMG] = `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\n` +
      `stream\n${bin}\nendstream`;
  }

  const xobjRes = logo ? ` /XObject << /Im0 ${IMG} 0 R >>` : '';
  for (let i = 0; i < pageCount; i++) {
    const pageObj = firstPage + i * 2;
    const contentObj = pageObj + 1;
    objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjRes} >> /Contents ${contentObj} 0 R >>`;
    const content = pages[i];
    objects[contentObj] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
  }

  // ── Serialisieren mit xref ──
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  const maxObj = objects.length - 1;
  pdf += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObj; i++) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // ── data-URL (Latin-1-sicher) ──
  let bin = '';
  for (let i = 0; i < pdf.length; i++) bin += String.fromCharCode(pdf.charCodeAt(i) & 0xff);
  return `data:application/pdf;base64,${btoa(bin)}`;
}

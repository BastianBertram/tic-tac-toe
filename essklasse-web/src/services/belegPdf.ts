/**
 * Erzeugt einen Ersatz-Bewirtungsbeleg als PDF (data-URL) aus manuell
 * eingegebenen Bestelldaten + Positionen — ohne externe Abhängigkeit.
 *
 * Wird verwendet, wenn beim Anlegen kein Original-Bewirtungsbeleg hochgeladen,
 * aber alle Bestelldaten und mindestens eine Position erfasst wurden. Das
 * Ergebnis wird wie ein hochgeladenes Dokument unter `fotoDataUrls` abgelegt.
 *
 * Der PDF-Text nutzt WinAnsi-Encoding (Helvetica), damit deutsche Umlaute
 * korrekt dargestellt werden.
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
  /** Zeigt Preise/Summen im PDF (z.B. nur für Buchhaltung/Admin/GF). */
  showPreise?: boolean;
}

// ── Seiten-Geometrie (A4 in PDF-Punkten) ──
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const BOTTOM = 60;

// Typografische Sonderzeichen → WinAnsi (CP1252) Code-Punkte.
const WINANSI_SPECIAL: Record<number, number> = {
  0x20ac: 0x80, // €
  0x2026: 0x85, // …
  0x2013: 0x96, // – en dash
  0x2014: 0x97, // — em dash
  0x2018: 0x91, 0x2019: 0x92, // ‘ ’
  0x201c: 0x93, 0x201d: 0x94, // “ ”
  0x2022: 0x95, // •
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
    else out += '?'; // außerhalb Latin-1
  }
  return out;
}

function trunc(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

interface Line { x: number; size: number; bold?: boolean; text: string; gapBefore?: number; }

export function generateErsatzBelegPdf(b: ErsatzBelegInput): string {
  const lines: Line[] = [];

  const fmtDatum = (v: string) => {
    if (!v) return '–';
    const [y, m, d] = v.split('-');
    return d && m && y ? `${d}.${m}.${y}` : v;
  };
  const zeitraum = b.cateringDatumVon === b.cateringDatumBis
    ? fmtDatum(b.cateringDatumVon)
    : `${fmtDatum(b.cateringDatumVon)} – ${fmtDatum(b.cateringDatumBis)}`;
  const uhrzeit = [b.uhrzeitVon, b.uhrzeitBis].filter(Boolean).join(' – ') || '–';

  // ── Kopf ──
  lines.push({ x: MARGIN, size: 18, bold: true, text: 'Ersatz-Bewirtungsbeleg' });
  lines.push({ x: MARGIN, size: 9, text: 'Maschinell erstellt aus den manuell erfassten Bestelldaten (kein Original-Beleg hochgeladen).', gapBefore: 26 });
  lines.push({ x: MARGIN, size: 9, text: `Objekt: ${b.objektName || '–'}`, gapBefore: 13 });

  const row = (label: string, value: string) =>
    lines.push({ x: MARGIN, size: 11, text: `${label}:  ${value || '–'}` });

  lines.push({ x: MARGIN, size: 13, bold: true, text: 'Bestelldaten', gapBefore: 30 });
  row('Besteller / Auftraggeber', b.besteller);
  row('Veranstaltung / Anlass', b.veranstaltung);
  row('Datum', zeitraum);
  row('Uhrzeit', uhrzeit);
  row('Ort', b.ort);
  row('Raum', b.raum);
  row('Personenzahl', String(b.personenzahl || 0));

  if (b.konto || b.kostenstelle || b.kostentraeger) {
    lines.push({ x: MARGIN, size: 13, bold: true, text: 'Kostenzuordnung', gapBefore: 26 });
    if (b.konto)        row('Konto', b.konto);
    if (b.kostenstelle) row('Kostenstelle', b.kostenstelle);
    if (b.kostentraeger) row('Kostenträger', b.kostentraeger);
  }

  const hatRechnung = b.rechnungsanschriftFirma || b.rechnungsanschriftZuHaenden ||
    b.rechnungsanschriftStrasse || b.rechnungsanschriftPlzOrt || b.rechnungsanschriftAnlass ||
    b.rechnungsanschriftTeilnehmer || b.rechnungsanschriftTelefon;
  if (hatRechnung) {
    lines.push({ x: MARGIN, size: 13, bold: true, text: 'Rechnungsanschrift', gapBefore: 26 });
    if (b.rechnungsanschriftFirma)       row('Firma', b.rechnungsanschriftFirma);
    if (b.rechnungsanschriftZuHaenden)   row('Zu Händen', b.rechnungsanschriftZuHaenden);
    if (b.rechnungsanschriftStrasse)     row('Straße / Nr.', b.rechnungsanschriftStrasse);
    if (b.rechnungsanschriftPlzOrt)      row('PLZ / Ort', b.rechnungsanschriftPlzOrt);
    if (b.rechnungsanschriftAnlass)      row('Anlass', b.rechnungsanschriftAnlass);
    if (b.rechnungsanschriftTeilnehmer)  row('Teilnehmer', b.rechnungsanschriftTeilnehmer);
    if (b.rechnungsanschriftTelefon)     row('Telefon', b.rechnungsanschriftTelefon);
  }

  // ── Positionen (Spalten wie auf dem Original-Bewirtungsschein) ──
  // Bestellt = erfasste Menge; Ausgeliefert / Zurück (Voll, Leer) / Berechnen /
  // Pfand bleiben leer und werden erst beim Abschluss ausgefüllt.
  lines.push({ x: MARGIN, size: 13, bold: true, text: 'Positionen / Leistungen', gapBefore: 30 });
  const cBestellt = 232, cAusgel = 288, cVoll = 362, cLeer = 402, cBerechnen = 442, cPfand = 508;
  // Kopfzeile A: "Zurück" als Überschrift über den Unterspalten Voll / Leer
  lines.push({ x: (cVoll + cLeer) / 2 - 8, size: 7.5, bold: true, text: 'Zurück' });
  // Kopfzeile B: Einzelspalten auf einer Höhe
  lines.push({ x: MARGIN,     size: 7.5, bold: true, text: 'Bezeichnung',  gapBefore: 9 });
  lines.push({ x: cBestellt,  size: 7.5, bold: true, text: 'Bestellt',     gapBefore: -10.5 });
  lines.push({ x: cAusgel,    size: 7.5, bold: true, text: 'Ausgeliefert', gapBefore: -10.5 });
  lines.push({ x: cVoll,      size: 7.5, bold: true, text: 'Voll',         gapBefore: -10.5 });
  lines.push({ x: cLeer,      size: 7.5, bold: true, text: 'Leer',         gapBefore: -10.5 });
  lines.push({ x: cBerechnen, size: 7.5, bold: true, text: 'Berechnen',    gapBefore: -10.5 });
  lines.push({ x: cPfand,     size: 7.5, bold: true, text: 'Pfand',        gapBefore: -10.5 });

  let lastKat = '';
  for (const p of b.positionen) {
    if (p.kategorie !== lastKat) {
      lines.push({ x: MARGIN, size: 10, bold: true, text: String(p.kategorie), gapBefore: lastKat === '' ? 20 : 18 });
      lastKat = p.kategorie;
    }
    lines.push({ x: MARGIN + 6, size: 9.5, text: trunc(p.bezeichnung, 34) });
    lines.push({ x: cBestellt,  size: 9.5, text: String(p.menge), gapBefore: -12 });
  }

  if (b.wuensche?.trim()) {
    lines.push({ x: MARGIN, size: 13, bold: true, text: 'Wünsche / Hinweise', gapBefore: 28 });
    for (const part of wrap(b.wuensche.trim(), 95)) {
      lines.push({ x: MARGIN, size: 10, text: part });
    }
  }

  lines.push({ x: MARGIN, size: 8, text: `Erstellt am ${new Date().toLocaleString('de-DE')}`, gapBefore: 24 });

  return buildPdf(lines);
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

/** Baut aus den Zeilen ein mehrseitiges PDF und gibt eine data-URL zurück. */
function buildPdf(lines: Line[]): string {
  const pages: string[] = [];
  let stream = '';
  let y = PAGE_H - MARGIN;

  const flush = () => { pages.push(stream); stream = ''; y = PAGE_H - MARGIN; };

  for (const ln of lines) {
    const gap = ln.gapBefore ?? (ln.size + 5);
    // Negative Gaps positionieren auf gleicher Zeilenhöhe (Tabellenspalten) → kein Seitenumbruch
    if (gap >= 0) {
      y -= gap;
      if (y < BOTTOM) { flush(); y -= gap; }
    }
    const font = ln.bold ? '/F2' : '/F1';
    stream += `BT ${font} ${ln.size} Tf ${ln.x.toFixed(2)} ${y.toFixed(2)} Td (${esc(ln.text)}) Tj ET\n`;
  }
  flush();

  // ── PDF-Objekte zusammensetzen ──
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: F1, 4: F2, dann je Seite: Page + Content
  const pageObjStart = 5;
  const pageCount = pages.length;
  const kids: string[] = [];
  for (let i = 0; i < pageCount; i++) kids.push(`${pageObjStart + i * 2} 0 R`);

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${kids.join(' ')}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  for (let i = 0; i < pageCount; i++) {
    const pageObj = pageObjStart + i * 2;
    const contentObj = pageObj + 1;
    objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;
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
    const off = offsets[i] ?? 0;
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // ── data-URL (Latin-1-sicher kodieren) ──
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:application/pdf;base64,${btoa(bin)}`;
}

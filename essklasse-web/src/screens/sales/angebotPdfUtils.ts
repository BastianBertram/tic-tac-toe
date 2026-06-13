import type { Angebot, AngebotVersionSnapshot } from '../../types';
import type { Impressum } from '../../store/settingsStore';
import type { AngebotPdfInput } from '../../services/angebotPdf';

/** Löst einen Datei-Download einer data-URL aus. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Baut die PDF-Eingabe aus einem Angebot. Mit `snapshot` (aus einer Version)
 * werden die versionierten Felder daraus übernommen — sonst der Live-Stand.
 */
export function angebotPdfInput(
  a: Angebot,
  logoDataUrl: string | null,
  impressum: Impressum | null,
  snapshot?: AngebotVersionSnapshot,
  versionLabel?: string,
): AngebotPdfInput {
  const q = snapshot ?? a;
  return {
    nummer: a.nummer,
    kundeFirma: a.kundeFirma,
    ansprechpartner: a.ansprechpartner,
    email: a.email,
    telefon: a.telefon,
    betreff: q.betreff,
    einleitung: q.einleitung,
    zahlungsbedingungen: q.zahlungsbedingungen,
    lieferbedingungen: q.lieferbedingungen,
    gueltigBis: a.gueltigBis,
    positionen: q.positionen,
    rabattGesamtProzent: q.rabattGesamtProzent,
    gesamtsumme: q.gesamtsumme,
    versionLabel,
    logoDataUrl,
    impressum,
  };
}

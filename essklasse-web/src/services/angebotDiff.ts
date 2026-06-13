import type { Angebot, AngebotPosition, AngebotVersionSnapshot } from '../types';

export type DiffArt = 'added' | 'removed' | 'changed' | 'gleich';

export interface FeldDiff {
  feld: string;
  label: string;
  alt: string;
  neu: string;
  /** Geldbetrag? (für Formatierung) */
  geld?: boolean;
}

export interface PositionDiff {
  id: string;
  bezeichnung: string;
  art: DiffArt;
  /** geänderte Felder, wenn art === 'changed' */
  felder: FeldDiff[];
  /** Position-Snapshots (für die Anzeige der Werte) */
  alt?: AngebotPosition;
  neu?: AngebotPosition;
}

export interface AngebotDiff {
  felder: FeldDiff[];
  positionen: PositionDiff[];
  /** true, wenn keinerlei Unterschiede bestehen */
  gleich: boolean;
}

/** Aktuellen Live-Stand eines Angebots als Snapshot (für „Aktuell"-Vergleich). */
export function aktuellerSnapshot(a: Angebot): AngebotVersionSnapshot {
  return {
    positionen: a.positionen.map(p => ({ ...p })),
    betreff: a.betreff,
    einleitung: a.einleitung,
    zahlungsbedingungen: a.zahlungsbedingungen,
    lieferbedingungen: a.lieferbedingungen,
    gesamtsumme: a.gesamtsumme,
    rabattGesamtProzent: a.rabattGesamtProzent,
  };
}

const num = (v: number | undefined) => String(v ?? 0);
const txt = (v: string | undefined) => v ?? '';

/** Vergleicht zwei Snapshots (alt → neu) und liefert hervorhebbare Unterschiede. */
export function diffSnapshots(alt: AngebotVersionSnapshot, neu: AngebotVersionSnapshot): AngebotDiff {
  const felder: FeldDiff[] = [];
  const pushIf = (feld: string, label: string, a: string, b: string, geld = false) => {
    if (a !== b) felder.push({ feld, label, alt: a, neu: b, geld });
  };
  pushIf('betreff', 'Betreff', txt(alt.betreff), txt(neu.betreff));
  pushIf('einleitung', 'Einleitung', txt(alt.einleitung), txt(neu.einleitung));
  pushIf('zahlungsbedingungen', 'Zahlungsbedingungen', txt(alt.zahlungsbedingungen), txt(neu.zahlungsbedingungen));
  pushIf('lieferbedingungen', 'Lieferbedingungen', txt(alt.lieferbedingungen), txt(neu.lieferbedingungen));
  pushIf('rabattGesamtProzent', 'Gesamtrabatt %', num(alt.rabattGesamtProzent), num(neu.rabattGesamtProzent));
  pushIf('gesamtsumme', 'Endpreis', num(alt.gesamtsumme), num(neu.gesamtsumme), true);

  const altMap = new Map(alt.positionen.map(p => [p.id, p]));
  const neuMap = new Map(neu.positionen.map(p => [p.id, p]));
  const ids = [...new Set([...altMap.keys(), ...neuMap.keys()])];

  const positionen: PositionDiff[] = ids.map(id => {
    const a = altMap.get(id);
    const b = neuMap.get(id);
    if (a && !b) return { id, bezeichnung: a.bezeichnung, art: 'removed', felder: [], alt: a };
    if (!a && b) return { id, bezeichnung: b.bezeichnung, art: 'added', felder: [], neu: b };
    if (a && b) {
      const f: FeldDiff[] = [];
      if (a.bezeichnung !== b.bezeichnung) f.push({ feld: 'bezeichnung', label: 'Bezeichnung', alt: a.bezeichnung, neu: b.bezeichnung });
      if (a.menge !== b.menge)             f.push({ feld: 'menge', label: 'Menge', alt: num(a.menge), neu: num(b.menge) });
      if (a.einheit !== b.einheit)         f.push({ feld: 'einheit', label: 'Einheit', alt: a.einheit, neu: b.einheit });
      if (a.einzelpreis !== b.einzelpreis) f.push({ feld: 'einzelpreis', label: 'Einzelpreis', alt: num(a.einzelpreis), neu: num(b.einzelpreis), geld: true });
      if ((a.rabattProzent ?? 0) !== (b.rabattProzent ?? 0)) f.push({ feld: 'rabattProzent', label: 'Rabatt %', alt: num(a.rabattProzent), neu: num(b.rabattProzent) });
      if ((a.geloescht ?? false) !== (b.geloescht ?? false)) f.push({ feld: 'geloescht', label: 'Gelöscht', alt: a.geloescht ? 'ja' : 'nein', neu: b.geloescht ? 'ja' : 'nein' });
      return { id, bezeichnung: b.bezeichnung, art: f.length ? 'changed' : 'gleich', felder: f, alt: a, neu: b };
    }
    return { id, bezeichnung: '', art: 'gleich', felder: [] };
  });

  const changedPos = positionen.filter(p => p.art !== 'gleich');
  return { felder, positionen: changedPos, gleich: felder.length === 0 && changedPos.length === 0 };
}

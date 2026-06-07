export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export type Kategorie =
  | 'Heißgetränke'
  | 'Kaltgetränke'
  | 'Speisen/Snacks'
  | 'Sonderbestellungen'
  | 'Abräumservice'
  | 'Buffetaufbau'
  | 'Equipment'
  | 'Sonstiges';

export const KATEGORIEN: Kategorie[] = [
  'Heißgetränke', 'Kaltgetränke', 'Speisen/Snacks', 'Sonderbestellungen',
  'Abräumservice', 'Buffetaufbau', 'Equipment', 'Sonstiges',
];

export const EINHEITEN = ['Stk', 'Person', 'Std', 'Pauschale', 'kg', 'l', 'Packung'];

export interface BelegPosition {
  id: string;
  kategorie: Kategorie;
  bezeichnung: string;
  einheit: string;
  preis: number;
  menge: number;
}

/** Ein Objekt / Standort (z.B. „HWK Hauptgebäude", „Berufsschule Nord") */
export interface Objekt {
  id: string;
  name: string;
  adresse?: string;
  kuerzel?: string;   // z.B. "HWK-01" – erscheint im Switcher-Button
}

export interface AbschlussPosition {
  positionId: string;
  tatsaechlicheMenge: number;
  zurueckVoll?: number;
  zurueckLeer?: number;
  berechnen?: number;
  pfand?: number;
}

export interface Bewirtungsbeleg {
  id: string;
  objektId: string;
  objektName: string;
  // Abschluss
  abgeschlossen: boolean;
  abgeschlossenAm?: string;
  abgeschlossenVon?: string;
  abschlussPositionen?: AbschlussPosition[];  // tatsächliche Mengen
  abschlussfotos?: string[];
  besteller: string;
  cateringDatumVon: string;
  cateringDatumBis: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  veranstaltung: string;
  ort: string;
  raum: string;
  personenzahl: number;
  konto: string;
  kostenstelle: string;
  kostentraeger: string;
  positionen: BelegPosition[];
  fotoDataUrls: string[];
  wuensche: string;
  interneNotiz: string;
  erstelltAm: string;
  syncStatus: SyncStatus;
  bcAuftragsnummer?: string;
  bcFehler?: string;
}

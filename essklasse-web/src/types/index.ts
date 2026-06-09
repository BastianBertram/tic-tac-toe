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
  aktiv?: boolean;    // undefined = aktiv (rückwärtskompatibel)
}

export interface AbschlussPosition {
  positionId: string;
  tatsaechlicheMenge: number;
  zurueckVoll?: number;
  zurueckLeer?: number;
  berechnen?: number;
  pfand?: number;
}

export type UserRolle = 'user' | 'admin' | 'buchhaltung';

/** Ein App-User (für Admin-Verwaltung) */
export interface AppUser {
  id: string;
  name: string;
  email: string;
  rolle: UserRolle;
  /** Objekt-IDs, auf die der User Zugriff hat (nur relevant für rolle=user) */
  objektIds: string[];
  aktiv: boolean;
  erstelltAm: string;
}

export interface Bewirtungsbeleg {
  id: string;
  bestellungsnummer: string;   // z.B. "A260000001"
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
  erstelltVon?: string;
  syncStatus: SyncStatus;
  deleted?: boolean;
  bcAuftragsnummer?: string;
  bcFehler?: string;
  rechnungErstellt?: boolean;
  rechnungErstelltAm?: string;
  rechnungErstelltVon?: string;
  rechnungsnummer?: string;
}

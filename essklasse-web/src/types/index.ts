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
  name: string;          // Pflicht
  kuerzel: string;       // Pflicht, z.B. "HWK" oder "FBZ"
  strasse: string;       // Pflicht
  plz: string;           // Pflicht
  ort: string;           // Pflicht
  telefon?: string;      // Optional
  email?: string;        // Optional
  kostenstellen: string[]; // mind. eine
  /** @deprecated Einzelfeld – wird aus strasse+plz+ort zusammengesetzt */
  adresse?: string;
  aktiv?: boolean;
}

export interface AbschlussPosition {
  positionId: string;
  tatsaechlicheMenge: number;
  zurueckVoll?: number;
  zurueckLeer?: number;
  berechnen?: number;
  pfand?: number;
}

export type UserRolle = 'user' | 'admin' | 'buchhaltung' | 'bereichsleitung' | 'geschaeftsfuehrung';

export type Anrede = 'Herr' | 'Frau';

/** Ein App-User (für Admin-Verwaltung) */
export interface AppUser {
  id: string;
  anrede: Anrede;
  vorname: string;
  nachname: string;
  /** Vollständiger Name = vorname + nachname (abgeleitet, für Rückwärtskompatibilität) */
  name: string;
  email: string;
  telefon: string;
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
  deleted?: boolean;
  rechnungErstellt?: boolean;
  rechnungErstelltAm?: string;
  rechnungErstelltVon?: string;
  rechnungsnummer?: string;
}

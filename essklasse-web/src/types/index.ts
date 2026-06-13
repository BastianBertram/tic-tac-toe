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

export type UserRolle = 'user' | 'admin' | 'buchhaltung' | 'bereichsleitung' | 'geschaeftsfuehrung' | 'sales';

// ─────────────────────────────────────────────────────────────────────────────
// Sales / Vertrieb (Betriebsgastronomie & Catering)
// ─────────────────────────────────────────────────────────────────────────────

/** Vertriebssegment: laufende Betriebsverpflegung vs. einmaliges Event-Catering */
export type SalesSegment = 'betriebsgastronomie' | 'catering';

export const SALES_SEGMENTE: { value: SalesSegment; label: string }[] = [
  { value: 'betriebsgastronomie', label: 'Betriebsgastronomie' },
  { value: 'catering',            label: 'Catering' },
];

/** Pipeline-Stufen einer Vertriebs-Opportunity */
export type SalesStatus =
  | 'neu'           // Anfrage eingegangen
  | 'qualifiziert'  // Bedarf geprüft, qualifiziert
  | 'angebot'       // Angebot erstellt / versendet
  | 'verhandlung'   // in Verhandlung
  | 'gewonnen'      // Auftrag gewonnen
  | 'verloren';     // verloren / abgesagt

export const SALES_PIPELINE: SalesStatus[] = ['neu', 'qualifiziert', 'angebot', 'verhandlung', 'gewonnen', 'verloren'];

export const SALES_STATUS_LABEL: Record<SalesStatus, string> = {
  neu:          'Neu',
  qualifiziert: 'Qualifiziert',
  angebot:      'Angebot',
  verhandlung:  'Verhandlung',
  gewonnen:     'Gewonnen',
  verloren:     'Verloren',
};

/** Quelle eines Leads */
export type SalesQuelle = 'empfehlung' | 'website' | 'telefon' | 'messe' | 'bestandskunde' | 'sonstige';

export const SALES_QUELLEN: { value: SalesQuelle; label: string }[] = [
  { value: 'empfehlung',    label: 'Empfehlung' },
  { value: 'website',       label: 'Website' },
  { value: 'telefon',       label: 'Telefon' },
  { value: 'messe',         label: 'Messe / Event' },
  { value: 'bestandskunde', label: 'Bestandskunde' },
  { value: 'sonstige',      label: 'Sonstige' },
];

export type SalesAktivitaetTyp = 'anruf' | 'email' | 'termin' | 'notiz' | 'angebot' | 'statuswechsel';

export interface SalesAktivitaet {
  id: string;
  typ: SalesAktivitaetTyp;
  text: string;
  datum: string;        // ISO
  von?: string;         // Bearbeiter
}

/** Eine Vertriebs-Opportunity / Anfrage */
export interface SalesAnfrage {
  id: string;
  nummer: string;             // z.B. "L260001"
  objektId: string;           // Mandant/Objekt — bestimmt die Sichtbarkeit (wie bei Belegen)
  segment: SalesSegment;
  status: SalesStatus;
  quelle: SalesQuelle;

  // Kunde / Kontakt
  kundeFirma: string;
  ansprechpartner: string;
  email: string;
  telefon: string;

  // Veranstaltung / Bedarf
  veranstaltung: string;      // z.B. "Sommerfest 2026", "Kantinen-Vollverpflegung"
  datum?: string;             // geplantes Event-/Startdatum (yyyy-MM-dd)
  personenzahl: number;
  ort: string;

  // Wert
  geschaetzterWert: number;   // erwarteter Umsatz €
  /** bei Betriebsgastronomie: erwarteter Jahreswert; geschaetzterWert = monatlich * 12 möglich */
  wiederkehrend: boolean;

  // Vertriebssteuerung
  verantwortlich: string;     // zuständiger Vertriebler
  wiedervorlage?: string;     // nächster Follow-up (yyyy-MM-dd)
  verlustgrund?: string;      // wenn verloren
  notiz: string;
  aktivitaeten: SalesAktivitaet[];

  erstelltAm: string;
  aktualisiertAm: string;
}

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
  /** Versionsnummer des hinterlegten Belegs; +1 bei jeder Bearbeitung. */
  belegVersion?: number;
  wuensche: string;
  interneNotiz: string;
  rechnungsanschriftFirma?: string;
  rechnungsanschriftZuHaenden?: string;
  rechnungsanschriftStrasse?: string;
  rechnungsanschriftPlzOrt?: string;
  rechnungsanschriftAnlass?: string;
  rechnungsanschriftTeilnehmer?: string;
  rechnungsanschriftTelefon?: string;
  erstelltAm: string;
  erstelltVon?: string;
  deleted?: boolean;
  isDoppelt?: boolean;
  rechnungErstellt?: boolean;
  rechnungErstelltAm?: string;
  rechnungErstelltVon?: string;
  rechnungsnummer?: string;
}

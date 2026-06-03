export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface BelegPosition {
  id: string;
  kategorie: Kategorie;
  bezeichnung: string;
  einheit: string;
  preis: number;
  menge: number;
}

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
  'Heißgetränke',
  'Kaltgetränke',
  'Speisen/Snacks',
  'Sonderbestellungen',
  'Abräumservice',
  'Buffetaufbau',
  'Equipment',
  'Sonstiges',
];

export interface Bewirtungsbeleg {
  id: string;
  // Kopfdaten
  besteller: string;
  cateringDatumVon: string;   // ISO date string
  cateringDatumBis: string;
  uhrzeitVon: string;         // HH:mm
  uhrzeitBis: string;
  veranstaltung: string;
  ort: string;
  raum: string;
  personenzahl: number;
  konto: string;
  kostenstelle: string;
  kostentraeger: string;
  // Positionen
  positionen: BelegPosition[];
  // Fotos
  fotoUris: string[];
  // Sonstiges
  wuensche: string;
  interneNotiz: string;
  // Metadaten
  erstelltAm: string;
  syncStatus: SyncStatus;
  bcAuftragsnummer?: string;
  bcFehler?: string;
}

export interface BCConfig {
  tenantId: string;
  clientId: string;
  companyId: string;
  baseUrl: string;  // z.B. https://api.businesscentral.dynamics.com/v2.0/{tenantId}/production/ODataV4
}

export const EINHEITEN = ['Stk', 'Person', 'Std', 'Pauschale', 'kg', 'l', 'Packung'];

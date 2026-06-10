/**
 * Dev-only: füllt alle Stores mit realistischen Testdaten.
 * Wird nur im DEV-Modus gerendert.
 */
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useUserStore } from '../store/userStore';
import type { Bewirtungsbeleg, BelegPosition, AbschlussPosition } from '../types';

const today = format(new Date(), 'yyyy-MM-dd');
const d = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');
const s = (offset: number) => subDays(new Date(), offset).toISOString();

function pos(
  kategorie: Bewirtungsbeleg['positionen'][0]['kategorie'],
  bezeichnung: string,
  einheit: string,
  preis: number,
  menge: number,
): BelegPosition {
  return { id: uuidv4(), kategorie, bezeichnung, einheit, preis, menge };
}

function abschluss(positionen: BelegPosition[]): AbschlussPosition[] {
  return positionen.map(p => ({
    positionId: p.id,
    tatsaechlicheMenge: p.menge,
    berechnen: p.menge,
  }));
}

const OBJEKTE = [
  { id: 'demo-1', name: 'HWK Hannover Hauptgebäude', kuerzel: 'HWK-01', strasse: 'Berliner Allee 17', plz: '30175', ort: 'Hannover', telefon: '0511 34859-0', email: 'info@hwk-hannover.de', kostenstellen: ['KST-100', 'KST-101'], aktiv: true },
  { id: 'demo-2', name: 'Berufsschulzentrum Nord',   kuerzel: 'BSZ-N',  strasse: 'Podbielskistr. 22', plz: '30163', ort: 'Hannover', telefon: '0511 12345-0', email: '',                        kostenstellen: ['KST-200'],            aktiv: true },
  { id: 'demo-3', name: 'Bildungszentrum Mitte',     kuerzel: 'BZM',    strasse: 'Expo Plaza 4',      plz: '30539', ort: 'Hannover', telefon: '',             email: 'bzm@hwk-hannover.de',     kostenstellen: ['KST-300', 'KST-301'], aktiv: true },
];

const USERS_EXTRA = [
  { id: 'demo-user-2', anrede: 'Herr' as const, vorname: 'Peter',   nachname: 'Brandt',   name: 'Peter Brandt',    email: 'peter.brandt@hwk.de',   telefon: '0511 99001-20', rolle: 'user' as const,        objektIds: ['demo-2', 'demo-3'], aktiv: true,  erstelltAm: s(30) },
  { id: 'demo-user-3', anrede: 'Frau' as const,  vorname: 'Sandra',  nachname: 'Köhler',   name: 'Sandra Köhler',  email: 'sandra.koehler@hwk.de', telefon: '0511 99001-31', rolle: 'user' as const,        objektIds: ['demo-1', 'demo-2'], aktiv: true,  erstelltAm: s(20) },
  { id: 'demo-user-4', anrede: 'Herr' as const, vorname: 'Thomas',  nachname: 'Müller',   name: 'Thomas Müller',  email: 'thomas.mueller@hwk.de', telefon: '',              rolle: 'user' as const,        objektIds: ['demo-3'],           aktiv: false, erstelltAm: s(60) },
  { id: 'demo-buch-2',  anrede: 'Frau' as const, vorname: 'Britta', nachname: 'Hoffmann', name: 'Britta Hoffmann', email: 'b.hoffmann@hwk.de',    telefon: '0511 99001-50', rolle: 'buchhaltung' as const,     objektIds: [],                   aktiv: true,  erstelltAm: s(90) },
  { id: 'demo-bl-1',   anrede: 'Frau' as const, vorname: 'Maria',  nachname: 'Berger',  name: 'Maria Berger',  email: 'berger@hwk.de',    telefon: '0511 99001-60', rolle: 'bereichsleitung' as const,    objektIds: ['demo-1', 'demo-2'], aktiv: true, erstelltAm: s(45) },
  { id: 'demo-gf-1',  anrede: 'Herr' as const, vorname: 'Hans',   nachname: 'Müller',  name: 'Hans Müller',   email: 'gf@hwk-hannover.de', telefon: '0511 99001-10', rolle: 'geschaeftsfuehrung' as const, objektIds: [],                   aktiv: true, erstelltAm: s(180) },
];

function makeBeleg(overrides: Partial<Bewirtungsbeleg> & {
  objektId: string; objektName: string;
  datum: string; erstelltVon: string;
  uhrzeitVon?: string; uhrzeitBis?: string;
  positionen: BelegPosition[];
}): Bewirtungsbeleg {
  const year = overrides.datum.slice(2, 4);
  return {
    id: uuidv4(),
    bestellungsnummer: `A${year}${String(Math.floor(Math.random() * 9999999)).padStart(7, '0')}`,
    cateringDatumVon: overrides.datum,
    cateringDatumBis: overrides.datum,
    uhrzeitVon:  overrides.uhrzeitVon  ?? '09:00',
    uhrzeitBis:  overrides.uhrzeitBis  ?? '11:00',
    besteller: overrides.erstelltVon,
    veranstaltung: 'Besprechung',
    ort: overrides.objektName,
    raum: 'Raum 101',
    personenzahl: 10,
    konto: '4670',
    kostenstelle: 'KST-100',
    kostentraeger: '',
    fotoDataUrls: [],
    wuensche: '',
    interneNotiz: '',
    erstelltAm: s(3),
    erstelltVon: overrides.erstelltVon,
    abgeschlossen: false,
    deleted: false,
    ...overrides,
  };
}

export function seedAll() {
  // ── Objekte ────────────────────────────────────────────────────────────────
  useObjektStore.getState().setObjekte(OBJEKTE);

  // ── Users ──────────────────────────────────────────────────────────────────
  const existingIds = new Set(useUserStore.getState().users.map(u => u.id));
  const { users } = useUserStore.getState();
  const newUsers = USERS_EXTRA.filter(u => !existingIds.has(u.id));
  if (newUsers.length) {
    useUserStore.setState({ users: [...users, ...newUsers] });
  }

  // ── Belege ─────────────────────────────────────────────────────────────────
  const posMorgen = [
    pos('Heißgetränke',  'Kaffee',       'Person', 2.50, 20),
    pos('Kaltgetränke',  'Mineralwasser', 'Stk',   1.20, 12),
    pos('Speisen/Snacks','Gebäckteller', 'Stk',    18.00, 2),
  ];
  const posHeute1 = [
    pos('Heißgetränke',  'Kaffee & Tee Flatrate', 'Person', 4.80, 15),
    pos('Speisen/Snacks','Belegte Brötchen',       'Stk',    2.90, 30),
    pos('Kaltgetränke',  'Orangensaft',            'l',      3.50, 3),
  ];
  const posHeute2 = [
    pos('Buffetaufbau',  'Aufbau Buffet',  'Pauschale', 45.00, 1),
    pos('Speisen/Snacks','Mittagsbuffet',  'Person',    18.50, 25),
    pos('Abräumservice', 'Abräumen',       'Std',       22.00, 2),
  ];
  const posGestern = [
    pos('Heißgetränke',  'Espresso',          'Stk',   2.20, 8),
    pos('Speisen/Snacks','Obstkorb groß',     'Stk',  22.00, 1),
    pos('Equipment',     'Kaffeemaschine',    'Std',  15.00, 3),
  ];
  const posVorgestern = [
    pos('Sonderbestellungen','Weinkost-Paket', 'Pauschale', 120.00, 1),
    pos('Abräumservice',     'Abräumen',       'Std',        22.00,  3),
  ];
  const posWoche = [
    pos('Heißgetränke',  'Kaffee',       'Person', 2.50, 40),
    pos('Kaltgetränke',  'Wasser/Säfte', 'Person', 1.80, 40),
    pos('Speisen/Snacks','Lunchpaket',   'Person', 9.50, 40),
  ];

  const newBelege: Bewirtungsbeleg[] = [
    // Heute – offen
    makeBeleg({
      objektId: 'demo-1', objektName: 'HWK-01',
      datum: today, erstelltVon: 'Anna Schmidt',
      uhrzeitVon: '08:30', uhrzeitBis: '10:30',
      veranstaltung: 'Vorstandssitzung Q2',
      raum: 'Konferenzraum A',
      personenzahl: 15,
      positionen: posHeute1,
    }),
    // Heute – offen (anderes Objekt)
    makeBeleg({
      objektId: 'demo-2', objektName: 'BSZ-N',
      datum: today, erstelltVon: 'Peter Brandt',
      uhrzeitVon: '12:00', uhrzeitBis: '14:00',
      veranstaltung: 'Mittagsbesprechung Ausbildung',
      raum: 'Mensa',
      personenzahl: 25,
      positionen: posHeute2,
    }),
    // Morgen – offen
    makeBeleg({
      objektId: 'demo-1', objektName: 'HWK-01',
      datum: d(1), erstelltVon: 'Sandra Köhler',
      uhrzeitVon: '09:00', uhrzeitBis: '11:00',
      veranstaltung: 'Schulung Digitalisierung',
      raum: 'Seminarraum 3',
      personenzahl: 20,
      positionen: posMorgen,
    }),
    // Morgen – offen (BSZ)
    makeBeleg({
      objektId: 'demo-2', objektName: 'BSZ-N',
      datum: d(1), erstelltVon: 'Peter Brandt',
      uhrzeitVon: '14:00', uhrzeitBis: '16:00',
      veranstaltung: 'Elternabend',
      raum: 'Aula',
      personenzahl: 60,
      positionen: [
        pos('Kaltgetränke',  'Wasser still', 'Stk', 1.00, 60),
        pos('Speisen/Snacks','Kekse',        'Stk', 0.80, 60),
      ],
    }),
    // Übermorgen
    makeBeleg({
      objektId: 'demo-3', objektName: 'BZM',
      datum: d(2), erstelltVon: 'Thomas Müller',
      uhrzeitVon: '10:00', uhrzeitBis: '12:00',
      veranstaltung: 'Kick-off Projekt 2026',
      raum: 'Großer Sitzungssaal',
      personenzahl: 35,
      positionen: posWoche,
    }),
    // Gestern – abzuschließen (überfällig)
    makeBeleg({
      objektId: 'demo-1', objektName: 'HWK-01',
      datum: d(-1), erstelltVon: 'Anna Schmidt',
      uhrzeitVon: '13:00', uhrzeitBis: '15:00',
      veranstaltung: 'Projektmeeting Hochbau',
      raum: 'Raum 204',
      personenzahl: 8,
      positionen: posGestern,
      erstelltAm: s(2),
    }),
    // Vorgestern – abzuschließen
    makeBeleg({
      objektId: 'demo-2', objektName: 'BSZ-N',
      datum: d(-2), erstelltVon: 'Sandra Köhler',
      uhrzeitVon: '18:00', uhrzeitBis: '22:00',
      veranstaltung: 'Jahresabschlussfeier',
      raum: 'Festsaal',
      personenzahl: 80,
      positionen: posVorgestern,
      erstelltAm: s(4),
    }),
    // Letzte Woche – abgeschlossen
    makeBeleg({
      objektId: 'demo-1', objektName: 'HWK-01',
      datum: d(-7), erstelltVon: 'Anna Schmidt',
      uhrzeitVon: '09:00', uhrzeitBis: '17:00',
      veranstaltung: 'Ganztagesschulung IT',
      raum: 'PC-Raum 1',
      personenzahl: 40,
      positionen: posWoche,
      erstelltAm: s(10),
      abgeschlossen: true,
      abgeschlossenAm: s(6),
      abgeschlossenVon: 'Anna Schmidt',
      abschlussPositionen: abschluss(posWoche),
    }),
    // Letzte Woche – abgeschlossen + Rechnung erstellt
    makeBeleg({
      objektId: 'demo-3', objektName: 'BZM',
      datum: d(-10), erstelltVon: 'Peter Brandt',
      uhrzeitVon: '11:00', uhrzeitBis: '13:00',
      veranstaltung: 'Pressekonferenz',
      raum: 'Foyer',
      personenzahl: 30,
      positionen: [
        pos('Heißgetränke',  'Kaffee',        'Person', 2.50, 30),
        pos('Kaltgetränke',  'Orangensaft',   'Stk',    1.80, 20),
        pos('Speisen/Snacks','Fingerfood',    'Person', 12.00, 30),
        pos('Buffetaufbau',  'Buffet-Aufbau', 'Pauschale', 60.00, 1),
      ],
      erstelltAm: s(15),
      abgeschlossen: true,
      abgeschlossenAm: s(9),
      abgeschlossenVon: 'Peter Brandt',
      abschlussPositionen: abschluss([
        pos('Heißgetränke',  'Kaffee',        'Person', 2.50, 28),
        pos('Kaltgetränke',  'Orangensaft',   'Stk',    1.80, 18),
        pos('Speisen/Snacks','Fingerfood',    'Person', 12.00, 30),
        pos('Buffetaufbau',  'Buffet-Aufbau', 'Pauschale', 60.00, 1),
      ]),
      rechnungErstellt: true,
      rechnungErstelltAm: s(8),
      rechnungErstelltVon: 'Klaus Weber',
      rechnungsnummer: 'R260001',
    }),
  ];

  const existing = useBelegStore.getState().belege;
  const existingBelegIds = new Set(existing.map(b => b.id));
  // Nur hinzufügen, nicht doppeln – prüfe via Veranstaltungsname+Datum
  const existingKeys = new Set(existing.map(b => `${b.cateringDatumVon}|${b.veranstaltung}`));
  const toAdd = newBelege.filter(b => !existingKeys.has(`${b.cateringDatumVon}|${b.veranstaltung}`));

  if (toAdd.length) {
    useBelegStore.setState(st => ({
      belege: [...toAdd, ...st.belege],
      bestellungZaehler: { ...st.bestellungZaehler, '26': (st.bestellungZaehler['26'] ?? 0) + toAdd.length },
    }));
  }

  return { belege: toAdd.length, users: newUsers.length, objekte: OBJEKTE.length };
}

export function clearAll() {
  useBelegStore.setState({ belege: [], bestellungZaehler: {} });
}

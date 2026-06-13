/**
 * Dev-only: realistische Testdaten für die Sales-Pipeline.
 */
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, subDays } from 'date-fns';
import { useSalesStore } from '../store/salesStore';
import type { SalesAnfrage, SalesAktivitaet } from '../types';

const d  = (o: number) => format(addDays(new Date(), o), 'yyyy-MM-dd');
const iso = (o: number) => subDays(new Date(), o).toISOString();

let leadNr = 0;
function nr(datum?: string) {
  leadNr += 1;
  const year = (datum ?? new Date().toISOString().slice(0, 10)).slice(2, 4);
  return `L${year}${String(leadNr).padStart(4, '0')}`;
}

function akt(typ: SalesAktivitaet['typ'], text: string, tageHer: number, von = 'Lena Vogel'): SalesAktivitaet {
  return { id: uuidv4(), typ, text, datum: iso(tageHer), von };
}

function make(o: Partial<SalesAnfrage> & {
  segment: SalesAnfrage['segment'];
  status: SalesAnfrage['status'];
  kundeFirma: string;
  veranstaltung: string;
  geschaetzterWert: number;
}): SalesAnfrage {
  const datum = o.datum;
  return {
    id: uuidv4(),
    nummer: nr(datum),
    objektId: 'demo-1',          // Default; unten round-robin auf demo-1/2/3 verteilt
    quelle: 'website',
    ansprechpartner: 'Frau Beispiel',
    email: 'kontakt@beispiel.de',
    telefon: '0511 000000',
    personenzahl: 50,
    ort: 'Hannover',
    wiederkehrend: o.segment === 'betriebsgastronomie',
    verantwortlich: 'Lena Vogel',
    notiz: '',
    aktivitaeten: [akt('notiz', 'Anfrage angelegt', 14)],
    erstelltAm: iso(14),
    aktualisiertAm: iso(2),
    datum,
    ...o,
  } as SalesAnfrage;
}

const ANFRAGEN: SalesAnfrage[] = [
  make({
    segment: 'catering', status: 'neu', quelle: 'website',
    kundeFirma: 'TechNova GmbH', ansprechpartner: 'Herr Decker', email: 'decker@technova.de', telefon: '0511 220011',
    veranstaltung: 'Produktlaunch-Event', datum: d(34), personenzahl: 120, ort: 'Hannover Messe',
    geschaetzterWert: 9800, wiedervorlage: d(2),
    notiz: 'Fingerfood + Getränke, abendliches Event mit Bühne.',
    aktivitaeten: [akt('email', 'Erstanfrage über Website eingegangen', 1)],
    erstelltAm: iso(1), aktualisiertAm: iso(1),
  }),
  make({
    segment: 'betriebsgastronomie', status: 'qualifiziert', quelle: 'empfehlung',
    kundeFirma: 'Stadtwerke Hannover', ansprechpartner: 'Frau Lindemann', email: 'lindemann@swh.de', telefon: '0511 430022',
    veranstaltung: 'Kantinen-Vollverpflegung (250 MA)', datum: d(60), personenzahl: 250, ort: 'Hauptverwaltung',
    geschaetzterWert: 180000, wiedervorlage: d(1),
    notiz: 'Jahresvertrag, tägl. Mittagsverpflegung. Hoher Wert – Priorität.',
    aktivitaeten: [akt('termin', 'Standortbesichtigung vereinbart', 3), akt('anruf', 'Erstgespräch geführt', 6)],
    erstelltAm: iso(7), aktualisiertAm: iso(3),
  }),
  make({
    segment: 'catering', status: 'angebot', quelle: 'telefon',
    kundeFirma: 'Kanzlei Brandt & Partner', ansprechpartner: 'Herr Brandt', email: 'office@brandt-partner.de', telefon: '0511 778899',
    veranstaltung: 'Sommerfest Mitarbeiter', datum: d(45), personenzahl: 80, ort: 'Garten Kanzlei',
    geschaetzterWert: 6400, wiedervorlage: d(-1),
    notiz: 'Angebot v2 versendet, wartet auf Rückmeldung. ÜBERFÄLLIG nachfassen!',
    aktivitaeten: [akt('angebot', 'Angebot v2 versendet (6.400 €)', 4), akt('angebot', 'Angebot v1 versendet', 9)],
    erstelltAm: iso(12), aktualisiertAm: iso(4),
  }),
  make({
    segment: 'catering', status: 'verhandlung', quelle: 'messe',
    kundeFirma: 'Versicherung Nordstern AG', ansprechpartner: 'Frau Pohl', email: 'events@nordstern.de', telefon: '0511 556677',
    veranstaltung: 'Jahres-Gala 2026', datum: d(90), personenzahl: 300, ort: 'Congress Centrum',
    geschaetzterWert: 42000, wiedervorlage: d(3),
    notiz: 'Preisverhandlung läuft, Budget knapp. Menü-Upgrade als Hebel.',
    aktivitaeten: [akt('termin', 'Verhandlungstermin – Preis & Menü', 2), akt('angebot', 'Detailangebot versendet', 8)],
    erstelltAm: iso(20), aktualisiertAm: iso(2),
  }),
  make({
    segment: 'betriebsgastronomie', status: 'gewonnen', quelle: 'empfehlung',
    kundeFirma: 'Maschinenbau Wendt KG', ansprechpartner: 'Herr Wendt', email: 'wendt@wendt-kg.de', telefon: '0511 334455',
    veranstaltung: 'Werkskantine + Pausenversorgung', datum: d(-5), personenzahl: 140, ort: 'Werk Langenhagen',
    geschaetzterWert: 96000, wiederkehrend: true,
    notiz: 'Vertrag unterschrieben! Start zum Monatsanfang.',
    aktivitaeten: [akt('statuswechsel', 'Status → Gewonnen', 5), akt('termin', 'Vertragsunterzeichnung', 5)],
    erstelltAm: iso(40), aktualisiertAm: iso(5),
  }),
  make({
    segment: 'catering', status: 'gewonnen', quelle: 'bestandskunde',
    kundeFirma: 'TechNova GmbH', ansprechpartner: 'Herr Decker', email: 'decker@technova.de', telefon: '0511 220011',
    veranstaltung: 'Weihnachtsfeier 2025', datum: d(-30), personenzahl: 110, ort: 'Eventloft',
    geschaetzterWert: 11200, wiederkehrend: false,
    notiz: 'Erfolgreich durchgeführt, sehr zufrieden – Folgegeschäft wahrscheinlich.',
    aktivitaeten: [akt('statuswechsel', 'Status → Gewonnen', 35)],
    erstelltAm: iso(70), aktualisiertAm: iso(30),
  }),
  make({
    segment: 'catering', status: 'verloren', quelle: 'website',
    kundeFirma: 'StartUp Hub Hannover', ansprechpartner: 'Frau Klein', email: 'hello@startuphub.de', telefon: '0511 998877',
    veranstaltung: 'Netzwerk-Brunch', datum: d(-12), personenzahl: 60, ort: 'Coworking Space',
    geschaetzterWert: 3200, wiederkehrend: false, verlustgrund: 'Budget – Mitbewerber günstiger',
    notiz: 'An günstigeren Anbieter verloren.',
    aktivitaeten: [akt('statuswechsel', 'Status → Verloren (Budget)', 10), akt('angebot', 'Angebot versendet', 18)],
    erstelltAm: iso(25), aktualisiertAm: iso(10),
  }),
  make({
    segment: 'betriebsgastronomie', status: 'neu', quelle: 'telefon',
    kundeFirma: 'Logistik Zentrum Nord', ansprechpartner: 'Herr Albers', email: 'albers@lzn.de', telefon: '0511 121212',
    veranstaltung: 'Automaten- & Snackversorgung', datum: d(50), personenzahl: 90, ort: 'Logistikhalle',
    geschaetzterWert: 54000, wiedervorlage: d(5),
    notiz: 'Interesse an Snack-/Getränkeautomaten + 2x wöchentl. Frischeversorgung.',
    aktivitaeten: [akt('anruf', 'Telefonische Anfrage', 2)],
    erstelltAm: iso(2), aktualisiertAm: iso(2),
  }),
  make({
    segment: 'catering', status: 'qualifiziert', quelle: 'empfehlung',
    kundeFirma: 'Universität Hannover', ansprechpartner: 'Frau Dr. Roth', email: 'roth@uni-hannover.de', telefon: '0511 762000',
    veranstaltung: 'Fachkonferenz Tagungscatering', datum: d(40), personenzahl: 200, ort: 'Hauptcampus',
    geschaetzterWert: 15500, wiedervorlage: d(4),
    notiz: 'Mehrtägige Tagung, Kaffeepausen + Mittagsverpflegung.',
    aktivitaeten: [akt('email', 'Bedarf qualifiziert, Eckdaten erhalten', 5)],
    erstelltAm: iso(9), aktualisiertAm: iso(5),
  }),
];

// Leads auf die Demo-Objekte verteilen, damit die Mandantentrennung sichtbar ist
// (demo-1/demo-2 für den Sales-Demo-User; demo-3 nur für Admin/GF sichtbar).
const DEMO_OBJEKTE = ['demo-1', 'demo-2', 'demo-3'];
ANFRAGEN.forEach((a, i) => { a.objektId = DEMO_OBJEKTE[i % DEMO_OBJEKTE.length]; });

export function seedSales() {
  const existing = useSalesStore.getState().anfragen;
  if (existing.length > 0) return { anfragen: 0 };
  const maxYear = ANFRAGEN.reduce<Record<string, number>>((acc, a) => {
    const y = a.nummer.slice(1, 3);
    acc[y] = (acc[y] ?? 0) + 1;
    return acc;
  }, {});
  useSalesStore.setState({ anfragen: ANFRAGEN, leadZaehler: maxYear });
  return { anfragen: ANFRAGEN.length };
}

/**
 * Server-seitiger Stammdaten-Seed (Benutzer & Objekte).
 *
 * Wird beim Serverstart einmalig angelegt, falls die jeweilige Kollektion noch
 * nicht existiert. Dadurch sind `users`/`objekte` NIE leer — ein öffentlicher
 * „Bootstrap"-PUT (der sonst zur Selbstvergabe der Admin-Rolle missbraucht
 * werden könnte) ist damit überflüssig und entfällt. Der Admin-Write-Gate gilt
 * folglich ausnahmslos.
 *
 * Hält die Demo-Daten mit dem Client (src/store/userStore.ts, src/dev/seedData.ts)
 * konsistent, damit der Client beim ersten Start sauber vom Server hydriert.
 */
const T = '2026-01-01T00:00:00.000Z';

export const SEED_USERS = [
  { id: 'demo-admin',  anrede: 'Herr', vorname: 'Max',    nachname: 'Mustermann', name: 'Max Mustermann',  email: 'max@hwk-hannover.de',         telefon: '',              rolle: 'admin',            objektIds: [],                   aktiv: true,  erstelltAm: T },
  { id: 'demo-user-1', anrede: 'Frau', vorname: 'Anna',   nachname: 'Schmidt',    name: 'Anna Schmidt',    email: 'anna@hwk-hannover.de',        telefon: '',              rolle: 'user',             objektIds: ['demo-1'],           aktiv: true,  erstelltAm: T },
  { id: 'demo-buch-1', anrede: 'Herr', vorname: 'Klaus',  nachname: 'Weber',      name: 'Klaus Weber',     email: 'buchhaltung@hwk-hannover.de', telefon: '',              rolle: 'buchhaltung',      objektIds: ['__alle__'],         aktiv: true,  erstelltAm: T },
  { id: 'demo-user-2', anrede: 'Herr', vorname: 'Peter',  nachname: 'Brandt',     name: 'Peter Brandt',    email: 'peter.brandt@hwk.de',         telefon: '0511 99001-20', rolle: 'user',             objektIds: ['demo-2', 'demo-3'], aktiv: true,  erstelltAm: T },
  { id: 'demo-user-3', anrede: 'Frau', vorname: 'Sandra', nachname: 'Köhler',     name: 'Sandra Köhler',   email: 'sandra.koehler@hwk.de',       telefon: '0511 99001-31', rolle: 'user',             objektIds: ['demo-1', 'demo-2'], aktiv: true,  erstelltAm: T },
  { id: 'demo-user-4', anrede: 'Herr', vorname: 'Thomas', nachname: 'Müller',     name: 'Thomas Müller',   email: 'thomas.mueller@hwk.de',       telefon: '',              rolle: 'user',             objektIds: ['demo-3'],           aktiv: false, erstelltAm: T },
  { id: 'demo-buch-2', anrede: 'Frau', vorname: 'Britta', nachname: 'Hoffmann',   name: 'Britta Hoffmann', email: 'b.hoffmann@hwk.de',           telefon: '0511 99001-50', rolle: 'buchhaltung',      objektIds: [],                   aktiv: true,  erstelltAm: T },
  { id: 'demo-bl-1',   anrede: 'Frau', vorname: 'Maria',  nachname: 'Berger',     name: 'Maria Berger',    email: 'berger@hwk.de',               telefon: '0511 99001-60', rolle: 'bereichsleitung',  objektIds: ['demo-1', 'demo-2'], aktiv: true,  erstelltAm: T },
  { id: 'demo-gf-1',   anrede: 'Herr', vorname: 'Hans',   nachname: 'Müller',     name: 'Hans Müller',     email: 'gf@hwk-hannover.de',          telefon: '0511 99001-10', rolle: 'geschaeftsfuehrung', objektIds: [],                 aktiv: true,  erstelltAm: T },
  { id: 'demo-sales',  anrede: 'Frau', vorname: 'Lena',   nachname: 'Vogel',      name: 'Lena Vogel',      email: 'sales@hwk.de',                telefon: '0511 99001-70', rolle: 'sales',            objektIds: ['demo-1', 'demo-2'], aktiv: true,  erstelltAm: T },
];

export const SEED_OBJEKTE = [
  { id: 'demo-1', name: 'HWK Hannover Hauptgebäude', kuerzel: 'HWK-01', strasse: 'Berliner Allee 17', plz: '30175', ort: 'Hannover', telefon: '0511 34859-0', email: 'info@hwk-hannover.de', kostenstellen: ['KST-100', 'KST-101'], aktiv: true },
  { id: 'demo-2', name: 'Berufsschulzentrum Nord',   kuerzel: 'BSZ-N',  strasse: 'Podbielskistr. 22', plz: '30163', ort: 'Hannover', telefon: '0511 12345-0', email: '',                    kostenstellen: ['KST-200'],            aktiv: true },
  { id: 'demo-3', name: 'Bildungszentrum Mitte',     kuerzel: 'BZM',    strasse: 'Expo Plaza 4',      plz: '30539', ort: 'Hannover', telefon: '',             email: 'bzm@hwk-hannover.de',  kostenstellen: ['KST-300', 'KST-301'], aktiv: true },
];

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Angebot, AngebotPosition, AngebotStatus, AngebotVersionSnapshot } from '../types';
import { useSettingsStore } from './settingsStore';

interface AngeboteStore {
  angebote: Angebot[];
  /** Laufender Zähler für Angebotsnummern, pro Kalenderjahr */
  angebotZaehler: Record<string, number>;

  addAngebot: (a: Omit<Angebot, 'id' | 'nummer' | 'status' | 'positionen' | 'versionen' | 'gesamtsumme' | 'genehmigungErforderlich' | 'erstelltAm' | 'aktualisiertAm'> & { positionen?: AngebotPosition[]; status?: AngebotStatus }, vorgabeNummer?: string) => string;
  updateAngebot: (id: string, partial: Partial<Angebot>) => void;
  deleteAngebot: (id: string) => void;
  setStatus: (id: string, status: AngebotStatus) => void;

  addPosition: (id: string, pos: Omit<AngebotPosition, 'id' | 'gesamt'>) => void;
  updatePosition: (id: string, posId: string, partial: Partial<AngebotPosition>) => void;
  /** Soft-Delete der Position (bleibt in alten Versions-Snapshots sichtbar). */
  removePosition: (id: string, posId: string) => void;

  /** Snapshot der aktuellen Felder als neue Version festhalten. */
  neueVersion: (id: string, aenderung?: string, von?: string, major?: boolean) => void;
  /** Eine frühere Version wiederherstellen (nur admin/GF — UI-gated). */
  wiederherstellen: (id: string, version: string) => void;

  genehmigen: (id: string, von?: string) => void;
  ablehnen: (id: string, von?: string) => void;
}

// ── Berechnungs-Helfer ───────────────────────────────────────────────────────
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Positions-Gesamtpreis: menge * einzelpreis * (1 - rabattProzent/100). */
export function posGesamt(p: Pick<AngebotPosition, 'menge' | 'einzelpreis' | 'rabattProzent'>): number {
  return round2((p.menge || 0) * (p.einzelpreis || 0) * (1 - (p.rabattProzent ?? 0) / 100));
}

/** Höchster vergebener Rabatt (Positions- oder Gesamtrabatt) in %. */
function maxRabatt(positionen: AngebotPosition[], rabattGesamtProzent?: number): number {
  const posMax = positionen.reduce((m, p) => p.geloescht ? m : Math.max(m, p.rabattProzent ?? 0), 0);
  return Math.max(posMax, rabattGesamtProzent ?? 0);
}

/** Neu berechnete Positions-Gesamtpreise, Angebotssumme und Genehmigungs-Flag. */
function berechne(a: Pick<Angebot, 'positionen' | 'rabattGesamtProzent'>): { positionen: AngebotPosition[]; gesamtsumme: number; genehmigungErforderlich: boolean } {
  const positionen = a.positionen.map(p => ({ ...p, gesamt: posGesamt(p) }));
  const netto = positionen.reduce((sum, p) => p.geloescht ? sum : sum + p.gesamt, 0);
  const gesamtsumme = round2(netto * (1 - (a.rabattGesamtProzent ?? 0) / 100));
  const limit = useSettingsStore.getState().rabattLimitProzent ?? 15;
  const genehmigungErforderlich = maxRabatt(positionen, a.rabattGesamtProzent) > limit;
  return { positionen, gesamtsumme, genehmigungErforderlich };
}

/** Nächste Versionsnummer aus den bestehenden Versionen ableiten. */
function naechsteVersion(versionen: { version: string }[], major: boolean): string {
  if (versionen.length === 0) return '1.0';
  const last = versionen[versionen.length - 1].version;
  const [maj, min] = last.split('.').map(n => parseInt(n, 10) || 0);
  return major ? `${maj + 1}.0` : `${maj}.${min + 1}`;
}

export const useAngeboteStore = create<AngeboteStore>()(
  persist(
    (set, get) => ({
      angebote: [],
      angebotZaehler: {},

      addAngebot: (a, vorgabeNummer) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const year = (a.gueltigBis ?? now.slice(0, 10)).slice(2, 4);
        // Bevorzugt die serverseitig atomar vergebene Nummer; lokale Vergabe nur
        // im Offline-Notbetrieb (Server nicht erreichbar).
        const lokalNaechste = (get().angebotZaehler[year] ?? 0) + 1;
        const nummer = vorgabeNummer ?? `AN${year}${String(lokalNaechste).padStart(4, '0')}`;
        const positionen = a.positionen ?? [];
        const { positionen: berechnetePos, gesamtsumme, genehmigungErforderlich } = berechne({ positionen, rabattGesamtProzent: a.rabattGesamtProzent });
        set(s => ({
          angebotZaehler: vorgabeNummer ? s.angebotZaehler : { ...s.angebotZaehler, [year]: lokalNaechste },
          angebote: [{
            ...a,
            id,
            nummer,
            status: a.status ?? 'entwurf',
            positionen: berechnetePos,
            gesamtsumme,
            genehmigungErforderlich,
            versionen: [],
            erstelltAm: now,
            aktualisiertAm: now,
          }, ...s.angebote],
        }));
        return id;
      },

      updateAngebot: (id, partial) =>
        set(s => ({
          angebote: s.angebote.map(a => {
            if (a.id !== id) return a;
            const naechst = { ...a, ...partial };
            const { positionen, gesamtsumme, genehmigungErforderlich } = berechne(naechst);
            return { ...naechst, positionen, gesamtsumme, genehmigungErforderlich, aktualisiertAm: new Date().toISOString() };
          }),
        })),

      deleteAngebot: (id) =>
        set(s => ({ angebote: s.angebote.map(a => a.id === id ? { ...a, deleted: true, aktualisiertAm: new Date().toISOString() } : a) })),

      setStatus: (id, status) =>
        set(s => ({ angebote: s.angebote.map(a => a.id === id ? { ...a, status, aktualisiertAm: new Date().toISOString() } : a) })),

      addPosition: (id, pos) =>
        get().updateAngebot(id, { positionen: [...(get().angebote.find(a => a.id === id)?.positionen ?? []), { ...pos, id: uuidv4(), gesamt: posGesamt(pos) }] }),

      updatePosition: (id, posId, partial) => {
        const a = get().angebote.find(x => x.id === id);
        if (!a) return;
        get().updateAngebot(id, { positionen: a.positionen.map(p => p.id === posId ? { ...p, ...partial } : p) });
      },

      removePosition: (id, posId) => {
        const a = get().angebote.find(x => x.id === id);
        if (!a) return;
        get().updateAngebot(id, { positionen: a.positionen.map(p => p.id === posId ? { ...p, geloescht: true } : p) });
      },

      neueVersion: (id, aenderung, von, major = false) =>
        set(s => ({
          angebote: s.angebote.map(a => {
            if (a.id !== id) return a;
            const snapshot: AngebotVersionSnapshot = {
              positionen: a.positionen.map(p => ({ ...p })),
              betreff: a.betreff,
              einleitung: a.einleitung,
              zahlungsbedingungen: a.zahlungsbedingungen,
              lieferbedingungen: a.lieferbedingungen,
              gesamtsumme: a.gesamtsumme,
              rabattGesamtProzent: a.rabattGesamtProzent,
            };
            const version = naechsteVersion(a.versionen, major);
            return {
              ...a,
              versionen: [...a.versionen, { version, erstelltAm: new Date().toISOString(), erstelltVon: von, aenderung, snapshot }],
              aktualisiertAm: new Date().toISOString(),
            };
          }),
        })),

      wiederherstellen: (id, version) => {
        const a = get().angebote.find(x => x.id === id);
        const v = a?.versionen.find(x => x.version === version);
        if (!a || !v) return;
        get().updateAngebot(id, {
          positionen: v.snapshot.positionen.map(p => ({ ...p })),
          betreff: v.snapshot.betreff,
          einleitung: v.snapshot.einleitung,
          zahlungsbedingungen: v.snapshot.zahlungsbedingungen,
          lieferbedingungen: v.snapshot.lieferbedingungen,
          rabattGesamtProzent: v.snapshot.rabattGesamtProzent,
        });
      },

      genehmigen: (id, von) =>
        set(s => ({
          angebote: s.angebote.map(a => a.id === id ? {
            ...a, genehmigtVon: von, genehmigtAm: new Date().toISOString(),
            status: a.status === 'genehmigung' ? 'entwurf' : a.status,
            aktualisiertAm: new Date().toISOString(),
          } : a),
        })),

      ablehnen: (id, von) =>
        set(s => ({
          angebote: s.angebote.map(a => a.id === id ? {
            ...a, status: 'abgelehnt', genehmigtVon: von, genehmigtAm: new Date().toISOString(),
            aktualisiertAm: new Date().toISOString(),
          } : a),
        })),
    }),
    { name: 'essklasse-angebote' }
  )
);

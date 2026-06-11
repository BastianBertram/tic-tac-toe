/**
 * Synchronisiert die persistenten Zustand-Stores mit dem Server, damit alle
 * Nutzer denselben Stand sehen.
 *
 * Pro Kollektion:
 *  1. beim Start vom Server laden (hydrate). Ist die Kollektion serverseitig
 *     noch nicht angelegt, wird der lokale (ggf. geseedete) Stand hochgeladen.
 *  2. danach jede lokale Änderung (debounced) zurück auf den Server schreiben.
 *
 * localStorage bleibt nur als Offline-Cache aktiv; der Server ist führend.
 */
import type { StoreApi } from 'zustand';
import { fetchData, saveData } from './dataService';
import { useUserStore } from '../store/userStore';
import { useObjektStore } from '../store/objektStore';
import { useBelegStore } from '../store/belegStore';
import { useSalesStore } from '../store/salesStore';

interface SyncReg<S> {
  name: string;
  store: StoreApi<S>;
  /** Der serverseitig zu haltende Ausschnitt des States */
  select: (s: S) => Record<string, unknown>;
  /** Übernimmt Server-Daten in den Store */
  apply: (data: Record<string, unknown>) => void;
}

function reg<S>(r: SyncReg<S>) { return r as unknown as SyncReg<unknown>; }

const REGS: SyncReg<unknown>[] = [
  reg({
    name: 'users',
    store: useUserStore,
    select: s => ({ users: s.users }),
    apply: d => useUserStore.setState({ users: Array.isArray(d.users) ? d.users : [] }),
  }),
  reg({
    name: 'objekte',
    store: useObjektStore,
    // aktiveObjektId ist gerätelokal und wird NICHT synchronisiert
    select: s => ({ objekte: s.objekte }),
    apply: d => useObjektStore.getState().setObjekte(Array.isArray(d.objekte) ? d.objekte : []),
  }),
  reg({
    name: 'belege',
    store: useBelegStore,
    select: s => ({ belege: s.belege, bestellungZaehler: s.bestellungZaehler }),
    apply: d => useBelegStore.setState({
      belege: Array.isArray(d.belege) ? d.belege : [],
      bestellungZaehler: (d.bestellungZaehler ?? {}) as Record<string, number>,
    }),
  }),
  reg({
    name: 'sales',
    store: useSalesStore,
    select: s => ({ anfragen: s.anfragen, leadZaehler: s.leadZaehler }),
    apply: d => useSalesStore.setState({
      anfragen: Array.isArray(d.anfragen) ? d.anfragen : [],
      leadZaehler: (d.leadZaehler ?? {}) as Record<string, number>,
    }),
  }),
];

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const hydrating = new Set<string>();

function schedulePush(name: string, value: Record<string, unknown>) {
  const prev = pushTimers.get(name);
  if (prev) clearTimeout(prev);
  pushTimers.set(name, setTimeout(() => void saveData(name, value), 500));
}

let started = false;

/** Einmalig beim App-Start aufrufen. */
export async function initSync() {
  if (started) return;
  started = true;

  await Promise.all(REGS.map(async (r) => {
    const res = await fetchData<Record<string, unknown>>(r.name);

    hydrating.add(r.name);
    try {
      if (res?.initialized) {
        r.apply(res.data);          // Server ist führend
      } else if (res) {
        // Server kennt die Kollektion noch nicht → lokalen Stand hochladen (Seed)
        await saveData(r.name, r.select(r.store.getState()));
      }
      // res === null → Server offline, lokalen Cache behalten
    } finally {
      hydrating.delete(r.name);
    }

    // Ab jetzt jede lokale Änderung zurückschreiben
    r.store.subscribe((state) => {
      if (hydrating.has(r.name)) return;
      schedulePush(r.name, r.select(state));
    });
  }));
}

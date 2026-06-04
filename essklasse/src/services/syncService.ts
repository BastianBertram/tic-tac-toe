import { useBelegStore } from '../store/belegStore';
import { createSalesOrder } from './bcService';

export async function syncPendingBelege(): Promise<{ synced: number; failed: number }> {

  const store = useBelegStore.getState();
  const pending = store.getPendingBelege();
  let synced = 0;
  let failed = 0;

  for (const beleg of pending) {
    store.setSyncStatus(beleg.id, 'syncing');
    try {
      const result = await createSalesOrder(beleg);
      store.setBcAuftragsnummer(beleg.id, result.auftragsnummer);
      synced++;
    } catch (e: any) {
      store.setSyncStatus(beleg.id, 'error', e?.message ?? 'Unbekannter Fehler');
      failed++;
    }
  }

  return { synced, failed };
}

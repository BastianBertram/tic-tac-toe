import { useEffect, useState } from 'react';
import { useBelegStore } from '../store/belegStore';
import { checkDuplikate } from '../services/duplikatService';
import type { Bewirtungsbeleg } from '../types';
import s from './DuplikatCheckModal.module.css';

interface Props {
  beleg: Bewirtungsbeleg;
  onProceed: () => void;
  onCancel: () => void;
}

export function DuplikatCheckModal({ beleg, onProceed, onCancel }: Props) {
  const belege = useBelegStore(st => st.belege);
  const deleteBeleg = useBelegStore(st => st.deleteBeleg);
  const markDoppelt = useBelegStore(st => st.markDoppelt);

  const [state, setState] = useState<'checking' | 'found'>('checking');
  const [duplikate, setDuplikate] = useState<Bewirtungsbeleg[]>([]);

  useEffect(() => {
    const candidates = belege.filter(b => !b.deleted && b.rechnungErstellt && b.id !== beleg.id);
    checkDuplikate(beleg, candidates).then(found => {
      if (found.length === 0) {
        onProceed();
      } else {
        setDuplikate(found);
        setState('found');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(id: string) {
    deleteBeleg(id);
    markDoppelt(id);
    const remaining = duplikate.filter(d => d.id !== id);
    if (remaining.length === 0) {
      onProceed();
    } else {
      setDuplikate(remaining);
    }
  }

  if (state === 'checking') {
    return (
      <div className={s.overlay} onClick={onCancel}>
        <div className={s.sheet} onClick={e => e.stopPropagation()}>
          <div className={s.spinner} />
          <div className={s.checkingText}>Prüfe auf doppelte Belege…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.overlay} onClick={onCancel}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <div className={s.step}>Mögliche Doppelbuchung erkannt</div>
        <div className={s.title}>⚠️ Bereits vorhandene Rechnungen</div>
        <div className={s.body}>
          Für diese Bewirtung wurden möglicherweise bereits Rechnungen erstellt. Bitte prüfe, ob es sich um dieselbe Bewirtung handelt:
        </div>
        <div className={s.dupList}>
          {duplikate.map(d => (
            <div key={d.id} className={s.dupRow}>
              <div className={s.dupInfo}>
                <span className={s.dupRechnung}>{d.rechnungsnummer ?? '–'}</span>
                <span className={s.dupBestellung}>(Auftrag: {d.bestellungsnummer})</span>
                <span className={s.dupDetails}>{d.veranstaltung ?? ''} · {d.cateringDatumVon}</span>
              </div>
              <button
                type="button"
                className={s.deleteBtn}
                onClick={() => handleDelete(d.id)}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
        <div className={s.actions}>
          <button type="button" className={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
          <button type="button" className={s.proceedBtn} onClick={onProceed}>Trotzdem erstellen</button>
        </div>
      </div>
    </div>
  );
}

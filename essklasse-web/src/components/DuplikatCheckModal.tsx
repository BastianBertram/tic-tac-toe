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

  const [state, setState] = useState<'checking' | 'found' | 'deleteConfirm1' | 'deleteConfirm2'>('checking');
  const [duplikate, setDuplikate] = useState<Bewirtungsbeleg[]>([]);

  useEffect(() => {
    // Wenn dieser Beleg selbst schon eine Rechnungsnummer hat → sofort warnen
    if (beleg.rechnungsnummer) {
      setDuplikate([beleg]);
      setState('found');
      return;
    }
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

  function confirmDelete() {
    deleteBeleg(beleg.id);
    markDoppelt(beleg.id);
    onCancel();
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

  if (state === 'deleteConfirm1' || state === 'deleteConfirm2') {
    const step = state === 'deleteConfirm1' ? 0 : 1;
    return (
      <div className={s.overlay} onClick={() => setState('found')}>
        <div className={s.sheet} onClick={e => e.stopPropagation()}>
          <div className={s.step}>Schritt {step + 1} von 2</div>
          <div className={s.title}>{step === 0 ? 'Beleg löschen?' : 'Wirklich endgültig löschen?'}</div>
          <div className={s.body}>
            {step === 0
              ? `„${beleg.veranstaltung || 'Bewirtungsbeleg'}" wird gelöscht. Bitte beachte: Buchhaltung und Bereichsleitung können den gelöschten Beleg weiterhin einsehen und ggf. Rückfragen stellen.`
              : 'Wirklich fortfahren? Der Beleg bleibt für Buchhaltung und Bereichsleitung sichtbar und kann nicht wiederhergestellt werden.'}
          </div>
          <div className={s.actions}>
            <button type="button" className={s.cancelBtn} onClick={() => setState('found')}>Abbrechen</button>
            <button type="button" className={s.deleteCurrentBtn}
              onClick={() => step === 0 ? setState('deleteConfirm2') : confirmDelete()}>
              {step === 0 ? 'Weiter →' : 'Ja, endgültig löschen'}
            </button>
          </div>
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
            </div>
          ))}
        </div>
        <div className={s.actions}>
          <button type="button" className={s.cancelBtn} onClick={onCancel}>Abbrechen</button>
          <button type="button" className={s.deleteCurrentBtn} onClick={() => setState('deleteConfirm1')}>Diesen Beleg löschen</button>
          <button type="button" className={s.proceedBtn} onClick={onProceed}>Trotzdem erstellen</button>
        </div>
      </div>
    </div>
  );
}

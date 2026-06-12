import { useState } from 'react';
import { useObjektStore, useSichtbareObjekte, useObjektFilter, istObjektGebunden, ALLE_OBJEKTE } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import s from './ObjektSwitcher.module.css';

export function ObjektSwitcherButton() {
  const [open, setOpen] = useState(false);
  const aktiveObjektId = useObjektStore(s => s.aktiveObjektId);
  const objekte        = useSichtbareObjekte();
  const { aktivesObjekt: aktiv } = useObjektFilter();

  const alleAktiv = aktiveObjektId === ALLE_OBJEKTE;
  if (!aktiv && !alleAktiv) return null;

  return (
    <>
      <button className={s.trigger} onClick={() => setOpen(true)} type="button">
        <span className={s.triggerKuerzel}>{alleAktiv ? '∑' : (aktiv?.kuerzel ?? '🏢')}</span>
        <span className={s.triggerName}>{alleAktiv ? 'Alle Objekte' : aktiv?.name}</span>
        {objekte.length > 1 && <span className={s.triggerChevron}>⌄</span>}
      </button>

      {open && <ObjektSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function ObjektSheet({ onClose }: { onClose: () => void }) {
  const objekte          = useSichtbareObjekte();
  const aktiveObjektId   = useObjektStore(s => s.aktiveObjektId);
  const setAktiveObjektId = useObjektStore(s => s.setAktiveObjektId);
  const rolle = useAuthStore(st => st.user?.rolle);
  const darfAlle = istObjektGebunden(rolle) && objekte.length > 1;

  function select(id: string) {
    setAktiveObjektId(id);
    onClose();
  }

  const alleAktiv = aktiveObjektId === ALLE_OBJEKTE;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <div className={s.sheetHandle} />
        <h3 className={s.sheetTitle}>Objekt wechseln</h3>
        <p className={s.sheetSub}>Sie sehen nur Bewirtungen des gewählten Objekts.</p>

        <div className={s.list}>
          {/* Mehrere Objekte: alle zugeordneten Objekte gemeinsam ansehen */}
          {darfAlle && (
            <button
              className={`${s.item} ${alleAktiv ? s.itemActive : ''}`}
              onClick={() => select(ALLE_OBJEKTE)}
              type="button"
            >
              <div className={`${s.itemIcon} ${alleAktiv ? s.itemIconActive : ''}`}>∑</div>
              <div className={s.itemInfo}>
                <div className={s.itemName}>Alle Objekte</div>
                <div className={s.itemAddr}>Bewirtungen aller zugeordneten Objekte</div>
              </div>
              {alleAktiv && <span className={s.checkmark}>✓</span>}
            </button>
          )}
          {objekte.map(obj => {
            const active = obj.id === aktiveObjektId;
            const adresse = [obj.strasse, obj.plz && obj.ort ? `${obj.plz} ${obj.ort}` : '']
              .filter(Boolean).join(', ') || obj.adresse;
            return (
              <button
                key={obj.id}
                className={`${s.item} ${active ? s.itemActive : ''}`}
                onClick={() => select(obj.id)}
                type="button"
              >
                <div className={`${s.itemIcon} ${active ? s.itemIconActive : ''}`}>
                  {obj.kuerzel?.substring(0, 3) ?? '🏢'}
                </div>
                <div className={s.itemInfo}>
                  <div className={s.itemName}>{obj.name}</div>
                  {adresse && <div className={s.itemAddr}>{adresse}</div>}
                </div>
                {active && <span className={s.checkmark}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

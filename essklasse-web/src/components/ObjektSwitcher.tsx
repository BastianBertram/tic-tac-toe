import { useState } from 'react';
import { useObjektStore } from '../store/objektStore';
import s from './ObjektSwitcher.module.css';

export function ObjektSwitcherButton() {
  const [open, setOpen] = useState(false);
  const aktiv   = useObjektStore(s => s.getAktivesObjekt());
  const objekte = useObjektStore(s => s.objekte);

  if (!aktiv) return null;

  return (
    <>
      <button className={s.trigger} onClick={() => setOpen(true)} type="button">
        <span className={s.triggerKuerzel}>{aktiv.kuerzel ?? '🏢'}</span>
        <span className={s.triggerName}>{aktiv.name}</span>
        {objekte.length > 1 && <span className={s.triggerChevron}>⌄</span>}
      </button>

      {open && <ObjektSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function ObjektSheet({ onClose }: { onClose: () => void }) {
  const objekte          = useObjektStore(s => s.objekte);
  const aktiveObjektId   = useObjektStore(s => s.aktiveObjektId);
  const setAktiveObjektId = useObjektStore(s => s.setAktiveObjektId);

  function select(id: string) {
    setAktiveObjektId(id);
    onClose();
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()}>
        <div className={s.sheetHandle} />
        <h3 className={s.sheetTitle}>Objekt wechseln</h3>
        <p className={s.sheetSub}>Sie sehen nur Bewirtungen des gewählten Objekts.</p>

        <div className={s.list}>
          {objekte.map(obj => {
            const active = obj.id === aktiveObjektId;
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
                  {obj.adresse && <div className={s.itemAddr}>{obj.adresse}</div>}
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

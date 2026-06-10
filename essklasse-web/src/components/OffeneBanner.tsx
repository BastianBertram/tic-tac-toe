import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import s from './OffeneBanner.module.css';

interface Props { onTabSwitch?: () => void; }

export function OffeneBanner({ onTabSwitch }: Props) {
  const getOffene = useBelegStore(st => st.getOffeneBelege);
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  // Auf das aktive Objekt eingrenzen, damit die Zahl zur Abschluss-Liste passt.
  const count = getOffene().filter(b => !aktivesObjekt || b.objektId === aktivesObjekt.id).length;

  if (count === 0) return null;

  return (
    <button className={s.banner} onClick={onTabSwitch} type="button">
      <span className={s.icon}>⚠️</span>
      <span>
        <strong>{count} Bewirtung{count > 1 ? 'en' : ''}</strong> müssen noch abgeschlossen werden.
      </span>
      {onTabSwitch && <span className={s.arrow}>›</span>}
    </button>
  );
}

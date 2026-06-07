import { useBelegStore } from '../store/belegStore';
import s from './OffeneBanner.module.css';

interface Props { onTabSwitch?: () => void; }

export function OffeneBanner({ onTabSwitch }: Props) {
  const getOffene = useBelegStore(st => st.getOffeneBelege);
  const count = getOffene().length;

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

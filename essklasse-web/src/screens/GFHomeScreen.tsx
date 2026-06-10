import { useMemo } from 'react';
import { startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval, format } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import s from './GFHomeScreen.module.css';

export function GFHomeScreen() {
  const belege = useBelegStore(st => st.belege);

  const stats = useMemo(() => {
    const now      = new Date();
    const today    = format(now, 'yyyy-MM-dd');
    const nowTime  = format(now, 'HH:mm');
    const wStart   = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd     = endOfWeek(now,   { weekStartsOn: 1 });
    const nwStart  = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nwEnd    = endOfWeek(addWeeks(now, 1),   { weekStartsOn: 1 });

    const active = belege.filter(b => !b.deleted);

    const dieseWoche = active.filter(b =>
      isWithinInterval(parseISO(b.cateringDatumVon), { start: wStart, end: wEnd })
    ).length;

    const naechsteWoche = active.filter(b =>
      isWithinInterval(parseISO(b.cateringDatumVon), { start: nwStart, end: nwEnd })
    ).length;

    const ueberfaellig = active.filter(b => {
      if (b.abgeschlossen) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < nowTime) return true;
      return false;
    }).length;

    const rechnungsbereit = active.filter(b => b.abgeschlossen && !b.rechnungErstellt).length;

    return { dieseWoche, naechsteWoche, ueberfaellig, rechnungsbereit };
  }, [belege]);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.headerTitle}>🏠 Home</span>
      </div>
      <div className={s.grid}>
        <Kachel icon="📅" value={stats.dieseWoche}     label="Geplante Bewirtungen diese Woche" />
        <Kachel icon="📆" value={stats.naechsteWoche}  label="Geplante Bewirtungen nächste Woche" />
        <Kachel icon="⚠️" value={stats.ueberfaellig}   label="Überfällige Bewirtungen" urgent={stats.ueberfaellig > 0} />
        <Kachel icon="🧾" value={stats.rechnungsbereit} label="Bewirtungen bereit zur Rechnungserstellung" />
      </div>
    </div>
  );
}

function Kachel({ icon, value, label, urgent = false }: {
  icon: string; value: number; label: string; urgent?: boolean;
}) {
  return (
    <div className={`${s.kachel} ${urgent ? s.kachelUrgent : ''}`}>
      <span className={s.kachelIcon}>{icon}</span>
      <span className={s.kachelValue}>{value}</span>
      <span className={s.kachelLabel}>{label}</span>
    </div>
  );
}

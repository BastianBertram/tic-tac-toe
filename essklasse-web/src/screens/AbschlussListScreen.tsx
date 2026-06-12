import { useState, useMemo } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { format } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import { useObjektFilter } from '../store/objektStore';
import { BelegCard } from '../components/BelegCard';
import { OffeneBanner } from '../components/OffeneBanner';
import { AbschlussScreen } from './AbschlussScreen';
import type { Bewirtungsbeleg } from '../types';
import s from './AbschlussListScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; }

export function AbschlussListScreen({ onOpenBeleg }: Props) {
  const belege        = useBelegStore(st => st.belege);
  const { matchObjekt } = useObjektFilter();
  const [abschlussBeleg, setAbschlussBeleg] = useState<Bewirtungsbeleg | null>(null);

  const offene = useMemo(() => {
    const now   = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');
    return belege.filter(b => {
      if (b.deleted || b.abgeschlossen) return false;
      if (!matchObjekt(b.objektId)) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
      return false;
    });
  }, [belege, matchObjekt]);

  if (abschlussBeleg) {
    return (
      <AbschlussScreen
        beleg={abschlussBeleg}
        onClose={() => setAbschlussBeleg(null)}
        onDone={() => setAbschlussBeleg(null)}
      />
    );
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>✓ Bewirtung Abschließen</span>
      </div>

      <OffeneBanner />

      <div className={s.list}>
        {offene.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>✅</div>
            <h3>Alles abgeschlossen!</h3>
            <p>Keine offenen Bewirtungen vorhanden.</p>
          </div>
        ) : (
          offene.map(b => (
            <BelegCard
              key={b.id}
              beleg={b}
              onClick={() => onOpenBeleg(b)}
              onAbschliessen={() => setAbschlussBeleg(b)}
            />
          ))
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { BelegCard } from '../components/BelegCard';
import { AbschlussScreen } from './AbschlussScreen';
import type { Bewirtungsbeleg } from '../types';
import s from './AbschlussListScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; }

export function AbschlussListScreen({ onOpenBeleg }: Props) {
  const belege        = useBelegStore(st => st.belege);
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  const [abschlussBeleg, setAbschlussBeleg] = useState<Bewirtungsbeleg | null>(null);

  const offene = useMemo(() => {
    const now   = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');
    return belege.filter(b => {
      if (b.deleted || b.abgeschlossen) return false;
      if (aktivesObjekt && b.objektId !== aktivesObjekt.id) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < now) return true;
      return false;
    });
  }, [belege, aktivesObjekt]);

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
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.headerSection}>✓ Bewirtung Abschließen</span>
      </div>

      {offene.length > 0 && (
        <div className={s.urgentBanner}>
          <span className={s.urgentIcon}>⚠️</span>
          <span>
            <strong>{offene.length} Bewirtung{offene.length > 1 ? 'en' : ''}</strong> müssen noch abgeschlossen werden.
          </span>
        </div>
      )}

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

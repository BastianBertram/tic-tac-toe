import { useMemo } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { SalesStatus } from '../../types';
import { euro, isOffen, useSichtbareAnfragen } from './salesUtils';
import s from './SalesHomeScreen.module.css';

interface Props { onKachelClick: (filter: SalesStatus | 'alle' | 'wiedervorlage') => void; }

export function SalesHomeScreen({ onKachelClick }: Props) {
  const anfragen = useSichtbareAnfragen();

  const k = useMemo(() => {
    const now    = new Date();
    const today  = format(now, 'yyyy-MM-dd');
    const mStart = startOfMonth(now);
    const mEnd   = endOfMonth(now);

    const offen = anfragen.filter(isOffen);
    const offeneAnzahl = offen.length;
    const pipelineWert = offen.reduce((sum, a) => sum + (a.geschaetzterWert || 0), 0);

    const angebote = anfragen.filter(a => a.status === 'angebot' || a.status === 'verhandlung');

    const gewonnen = anfragen.filter(a => a.status === 'gewonnen');
    const verloren = anfragen.filter(a => a.status === 'verloren');
    const entschieden = gewonnen.length + verloren.length;
    const conversion = entschieden > 0 ? Math.round((gewonnen.length / entschieden) * 100) : 0;

    const umsatzMonat = gewonnen
      .filter(a => {
        if (!a.datum) return false;
        try { return isWithinInterval(parseISO(a.datum), { start: mStart, end: mEnd }); }
        catch { return false; }
      })
      .reduce((sum, a) => sum + (a.geschaetzterWert || 0), 0);

    const gewonnenWert = gewonnen.reduce((sum, a) => sum + (a.geschaetzterWert || 0), 0);

    const wiedervorlageFaellig = offen.filter(a => a.wiedervorlage && a.wiedervorlage <= today).length;

    return { offeneAnzahl, pipelineWert, angeboteAnzahl: angebote.length, conversion, umsatzMonat, gewonnenWert, wiedervorlageFaellig };
  }, [anfragen]);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerTitle}>🤝 Vertrieb</span>
      </div>

      <div className={s.scroll}>
        <div className={s.sectionLabel}>Pipeline</div>
        <div className={s.grid}>
          <Kachel icon="📥" value={String(k.offeneAnzahl)} label="Offene Anfragen"
            info="Alle noch nicht entschiedenen Opportunities (Neu, Qualifiziert, Angebot, Verhandlung)."
            onClick={() => onKachelClick('alle')} />
          <Kachel icon="💰" value={euro(k.pipelineWert)} label="Pipeline-Wert" accent="blue"
            info="Summe der geschätzten Auftragswerte aller offenen Anfragen — das gewichtete Potenzial."
            onClick={() => onKachelClick('alle')} />
          <Kachel icon="📄" value={String(k.angeboteAnzahl)} label="Angebote offen" accent="orange"
            info="Anfragen im Status Angebot oder Verhandlung — warten auf Kundenentscheidung."
            onClick={() => onKachelClick('angebot')} />
          <Kachel icon="⏰" value={String(k.wiedervorlageFaellig)} label="Wiedervorlagen fällig"
            accent={k.wiedervorlageFaellig > 0 ? 'urgent' : undefined}
            info="Offene Anfragen, deren Follow-up-Datum heute oder früher liegt — jetzt nachfassen."
            onClick={() => onKachelClick('wiedervorlage')} />
        </div>

        <div className={s.sectionLabel}>Erfolg</div>
        <div className={s.grid}>
          <Kachel icon="🎯" value={`${k.conversion}%`} label="Conversion-Rate" accent="green"
            info="Anteil gewonnener an allen entschiedenen Anfragen (gewonnen + verloren)."
            onClick={() => onKachelClick('gewonnen')} />
          <Kachel icon="🏆" value={euro(k.gewonnenWert)} label="Gewonnener Umsatz (gesamt)" accent="green"
            info="Summe der Auftragswerte aller gewonnenen Anfragen."
            onClick={() => onKachelClick('gewonnen')} />
          <Kachel icon="📆" value={euro(k.umsatzMonat)} label="Gewonnen diesen Monat" wide accent="green"
            info="Auftragswert der Anfragen, die mit Event-/Startdatum im aktuellen Monat gewonnen wurden."
            onClick={() => onKachelClick('gewonnen')} />
        </div>
      </div>
    </div>
  );
}

function Kachel({ icon, value, label, accent, wide, info, onClick }: {
  icon: string; value: string; label: string;
  accent?: 'green' | 'orange' | 'blue' | 'urgent'; wide?: boolean; info?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${s.kachel} ${accent ? s[`kachel${accent[0].toUpperCase()}${accent.slice(1)}`] : ''} ${wide ? s.kachelWide : ''}`}
      onClick={onClick}
    >
      {info && (
        <span className={s.infoWrap}>
          <span className={s.infoBtn} role="button" tabIndex={0} onClick={e => e.stopPropagation()} aria-label="Info">ℹ</span>
          <span className={s.tooltip}>{info}</span>
        </span>
      )}
      <span className={s.kachelIcon}>{icon}</span>
      <span className={s.kachelValue}>{value}</span>
      <span className={s.kachelLabel}>{label}</span>
    </button>
  );
}

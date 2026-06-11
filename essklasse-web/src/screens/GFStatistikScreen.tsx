import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import type { StatKategorie } from './GFStatistikDetailScreen';
import s from './GFStatistikScreen.module.css';

interface Props { onKachelClick: (k: StatKategorie) => void; }

export function GFStatistikScreen({ onKachelClick }: Props) {
  const belege = useBelegStore(st => st.belege);

  const stats = useMemo(() => {
    const now    = new Date();
    const today  = format(now, 'yyyy-MM-dd');
    const nowTime = format(now, 'HH:mm');
    const active = belege.filter(b => !b.deleted);

    const gesamt         = active.length;
    const abgeschlossen  = active.filter(b => b.abgeschlossen).length;
    const abschlussQuote = gesamt > 0 ? Math.round((abgeschlossen / gesamt) * 100) : 0;

    const offeneRechnungen = active.filter(b => b.abgeschlossen && !b.rechnungErstellt).length;
    const rechnungErstellt = active.filter(b => b.rechnungErstellt).length;

    const ueberfaellig = active.filter(b => {
      if (b.abgeschlossen) return false;
      if (b.cateringDatumVon < today) return true;
      if (b.cateringDatumVon === today && b.uhrzeitBis && b.uhrzeitBis < nowTime) return true;
      return false;
    }).length;

    // Durchschnittliche Personenzahl
    const mitPersonen = active.filter(b => b.personenzahl > 0);
    const avgPersonen = mitPersonen.length > 0
      ? Math.round(mitPersonen.reduce((sum, b) => sum + b.personenzahl, 0) / mitPersonen.length)
      : 0;

    // Höchste Personenzahl
    const maxPersonen = active.reduce((max, b) => Math.max(max, b.personenzahl ?? 0), 0);

    // Diesen Monat
    const mStart = startOfMonth(now);
    const mEnd   = endOfMonth(now);
    const diesenMonat = active.filter(b => {
      try { return isWithinInterval(parseISO(b.cateringDatumVon), { start: mStart, end: mEnd }); }
      catch { return false; }
    }).length;

    // Aktivstes Objekt
    const objektCount: Record<string, number> = {};
    active.forEach(b => {
      if (b.objektName) objektCount[b.objektName] = (objektCount[b.objektName] ?? 0) + 1;
    });
    const topObjekt = Object.entries(objektCount).sort((a, b) => b[1] - a[1])[0];

    // Meistgebuchter Raum
    const raumCount: Record<string, number> = {};
    active.forEach(b => {
      if (b.raum) raumCount[b.raum] = (raumCount[b.raum] ?? 0) + 1;
    });
    const topRaum = Object.entries(raumCount).sort((a, b) => b[1] - a[1])[0];

    // Top Besteller
    const bestellerCount: Record<string, number> = {};
    active.forEach(b => {
      if (b.besteller) bestellerCount[b.besteller] = (bestellerCount[b.besteller] ?? 0) + 1;
    });
    const topBesteller = Object.entries(bestellerCount).sort((a, b) => b[1] - a[1])[0];

    // Nächste Bewirtung
    const zukuenftig = active
      .filter(b => !b.abgeschlossen && b.cateringDatumVon >= today)
      .sort((a, b) => a.cateringDatumVon.localeCompare(b.cateringDatumVon));
    const naechste = zukuenftig[0];
    const naechsteTage = naechste
      ? differenceInDays(parseISO(naechste.cateringDatumVon), now)
      : null;

    // Älteste offene Bewirtung (Tage überfällig)
    const ueberfaelligBelege = active.filter(b => {
      if (b.abgeschlossen) return false;
      return b.cateringDatumVon < today;
    }).sort((a, b) => a.cateringDatumVon.localeCompare(b.cateringDatumVon));
    const aeltesteTage = ueberfaelligBelege[0]
      ? differenceInDays(now, parseISO(ueberfaelligBelege[0].cateringDatumVon))
      : null;

    // Monat label
    const monatLabel = format(now, 'MMMM', { locale: de });

    return {
      gesamt, abgeschlossen, abschlussQuote,
      offeneRechnungen, rechnungErstellt,
      ueberfaellig, avgPersonen, maxPersonen,
      diesenMonat, monatLabel,
      topObjekt, topRaum, topBesteller,
      naechste, naechsteTage, aeltesteTage,
    };
  }, [belege]);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        <span className={s.headerTitle}>📊 Statistik</span>
      </div>

      <div className={s.scroll}>
        <div className={s.sectionLabel}>Übersicht</div>
        <div className={s.grid}>
          <Kachel icon="🗂️" value={String(stats.gesamt)} label="Bewirtungen gesamt" info="Gesamtzahl aller Bewirtungsbelege in der App, unabhängig vom Status." onClick={() => onKachelClick('gesamt')} />
          <Kachel icon="✅" value={`${stats.abschlussQuote}%`} label="Abschlussquote" accent="green" info="Anteil der bereits abgeschlossenen Bewirtungen an allen Bewirtungen." onClick={() => onKachelClick('abschlussquote')} />
          <Kachel icon="📆" value={String(stats.diesenMonat)} label={`Bewirtungen im ${stats.monatLabel}`} info={`Anzahl der Bewirtungen, deren Datum im aktuellen Monat (${stats.monatLabel}) liegt.`} onClick={() => onKachelClick('monat')} />
          <Kachel icon="⚠️" value={String(stats.ueberfaellig)} label="Überfällig (offen)" accent={stats.ueberfaellig > 0 ? 'orange' : undefined} info="Noch nicht abgeschlossene Bewirtungen, deren Datum bereits in der Vergangenheit liegt." onClick={() => onKachelClick('ueberfaellig')} />
        </div>

        <div className={s.sectionLabel}>Rechnungen</div>
        <div className={s.grid}>
          <Kachel icon="🧾" value={String(stats.offeneRechnungen)} label="Bereit zur Rechnungserstellung" accent={stats.offeneRechnungen > 0 ? 'orange' : undefined} info="Abgeschlossene Bewirtungen, für die noch keine Rechnung in Business Central erstellt wurde." onClick={() => onKachelClick('offene-rechnungen')} />
          <Kachel icon="💼" value={String(stats.rechnungErstellt)} label="Rechnungen bereits erstellt" accent="green" info="Bewirtungen, die abgeschlossen sind und für die eine Rechnungsnummer eingetragen wurde." onClick={() => onKachelClick('rechnungen-erstellt')} />
        </div>

        <div className={s.sectionLabel}>Personen & Kapazität</div>
        <div className={s.grid}>
          <Kachel icon="👥" value={String(stats.avgPersonen)} label="Ø Personen pro Bewirtung" info="Durchschnittliche Personenzahl über alle Bewirtungen mit eingetragener Personenanzahl." onClick={() => onKachelClick('personen')} />
          <Kachel icon="🏆" value={String(stats.maxPersonen)} label="Größte Bewirtung (Pers.)" info="Höchste jemals eingetragene Personenzahl in einer einzelnen Bewirtung." onClick={() => onKachelClick('personen')} />
        </div>

        <div className={s.sectionLabel}>Top-Auswertungen</div>
        <div className={s.grid}>
          <Kachel icon="🏢" value={stats.topObjekt?.[1] ?? 0} label={`Aktivstes Objekt: ${stats.topObjekt?.[0] ?? '—'}`} info="Das Objekt mit den meisten Bewirtungsbelegen. Zahl = Anzahl Bewirtungen dort." onClick={() => onKachelClick('top-objekt')} />
          <Kachel icon="📍" value={stats.topRaum?.[1] ?? 0} label={`Meistgebuchter Raum: ${stats.topRaum?.[0] ?? '—'}`} info="Der Raum, der objektübergreifend am häufigsten für Bewirtungen gebucht wurde." onClick={() => onKachelClick('top-raum')} />
          <Kachel icon="👤" value={stats.topBesteller?.[1] ?? 0} label={`Top Besteller: ${stats.topBesteller?.[0] ?? '—'}`} wide info="Person mit den meisten aufgegebenen Bewirtungsbestellungen." onClick={() => onKachelClick('top-besteller')} />
        </div>

        <div className={s.sectionLabel}>Zeitliche Analyse</div>
        <div className={s.grid}>
          <Kachel
            icon="🔜"
            value={stats.naechste ? (stats.naechsteTage === 0 ? 'Heute' : `in ${stats.naechsteTage}d`) : '—'}
            label={stats.naechste ? `Nächste: ${stats.naechste.veranstaltung || stats.naechste.bestellungsnummer}` : 'Keine bevorstehenden Bewirtungen'}
            info="Tage bis zur nächsten noch offenen, bevorstehenden Bewirtung."
            onClick={() => onKachelClick('naechste')}
          />
          <Kachel
            icon="🕰️"
            value={stats.aeltesteTage !== null ? `${stats.aeltesteTage}d` : '—'}
            label="Längste offene Überfälligkeit"
            accent={stats.aeltesteTage !== null ? 'orange' : undefined}
            info="Wie viele Tage die älteste überfällige, noch nicht abgeschlossene Bewirtung bereits wartet."
            onClick={() => onKachelClick('aelteste')}
          />
        </div>
      </div>
    </div>
  );
}

function Kachel({ icon, value, label, accent, wide, info, onClick }: {
  icon: string; value: string | number; label: string;
  accent?: 'green' | 'orange'; wide?: boolean; info?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${s.kachel} ${accent === 'green' ? s.kachelGreen : ''} ${accent === 'orange' ? s.kachelOrange : ''} ${wide ? s.kachelWide : ''}`}
      onClick={onClick}
    >
      {info && (
        <span className={s.infoWrap}>
          <span
            className={s.infoBtn}
            role="button"
            tabIndex={0}
            onClick={e => e.stopPropagation()}
            aria-label="Info"
          >ℹ</span>
          <span className={s.tooltip}>{info}</span>
        </span>
      )}
      <span className={s.kachelIcon}>{icon}</span>
      <span className={s.kachelValue}>{value}</span>
      <span className={s.kachelLabel}>{label}</span>
    </button>
  );
}

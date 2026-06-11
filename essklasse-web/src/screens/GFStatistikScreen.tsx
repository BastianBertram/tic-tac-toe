import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import s from './GFStatistikScreen.module.css';

export function GFStatistikScreen() {
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
          <Kachel icon="🗂️" value={String(stats.gesamt)} label="Bewirtungen gesamt" />
          <Kachel icon="✅" value={`${stats.abschlussQuote}%`} label="Abschlussquote" accent="green" />
          <Kachel icon={stats.diesenMonat > 0 ? '📆' : '📆'} value={String(stats.diesenMonat)} label={`Bewirtungen im ${stats.monatLabel}`} />
          <Kachel icon="⚠️" value={String(stats.ueberfaellig)} label="Überfällig (offen)" accent={stats.ueberfaellig > 0 ? 'orange' : undefined} />
        </div>

        <div className={s.sectionLabel}>Rechnungen</div>
        <div className={s.grid}>
          <Kachel icon="🧾" value={String(stats.offeneRechnungen)} label="Bereit zur Rechnungserstellung" accent={stats.offeneRechnungen > 0 ? 'orange' : undefined} />
          <Kachel icon="💼" value={String(stats.rechnungErstellt)} label="Rechnungen bereits erstellt" accent="green" />
        </div>

        <div className={s.sectionLabel}>Personen & Kapazität</div>
        <div className={s.grid}>
          <Kachel icon="👥" value={String(stats.avgPersonen)} label="Ø Personen pro Bewirtung" />
          <Kachel icon="🏆" value={String(stats.maxPersonen)} label="Größte Bewirtung (Pers.)" />
        </div>

        <div className={s.sectionLabel}>Top-Auswertungen</div>
        <div className={s.grid}>
          <Kachel icon="🏢" value={stats.topObjekt?.[1] ?? 0} label={`Aktivstes Objekt: ${stats.topObjekt?.[0] ?? '—'}`} />
          <Kachel icon="📍" value={stats.topRaum?.[1] ?? 0} label={`Meistgebuchter Raum: ${stats.topRaum?.[0] ?? '—'}`} />
          <Kachel icon="👤" value={stats.topBesteller?.[1] ?? 0} label={`Top Besteller: ${stats.topBesteller?.[0] ?? '—'}`} wide />
        </div>

        <div className={s.sectionLabel}>Zeitliche Analyse</div>
        <div className={s.grid}>
          {stats.naechste && stats.naechsteTage !== null && (
            <Kachel
              icon="🔜"
              value={stats.naechsteTage === 0 ? 'Heute' : `in ${stats.naechsteTage}d`}
              label={`Nächste: ${stats.naechste.veranstaltung || stats.naechste.bestellungsnummer}`}
            />
          )}
          {stats.aeltesteTage !== null && (
            <Kachel
              icon="🕰️"
              value={`${stats.aeltesteTage}d`}
              label="Längste offene Überfälligkeit"
              accent="orange"
            />
          )}
          {!stats.naechste && stats.aeltesteTage === null && (
            <Kachel icon="🎉" value="—" label="Keine offenen Einträge" accent="green" />
          )}
        </div>
      </div>
    </div>
  );
}

function Kachel({ icon, value, label, accent, wide }: {
  icon: string; value: string | number; label: string;
  accent?: 'green' | 'orange'; wide?: boolean;
}) {
  return (
    <div className={`${s.kachel} ${accent === 'green' ? s.kachelGreen : ''} ${accent === 'orange' ? s.kachelOrange : ''} ${wide ? s.kachelWide : ''}`}>
      <span className={s.kachelIcon}>{icon}</span>
      <span className={s.kachelValue}>{value}</span>
      <span className={s.kachelLabel}>{label}</span>
    </div>
  );
}

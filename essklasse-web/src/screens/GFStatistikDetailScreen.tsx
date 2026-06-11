import { useMemo } from 'react';
import {
  format, parseISO, startOfMonth, endOfMonth,
  isWithinInterval, subMonths, differenceInDays,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import type { Bewirtungsbeleg } from '../types';
import s from './GFStatistikDetailScreen.module.css';

export type StatKategorie =
  | 'gesamt'
  | 'abschlussquote'
  | 'monat'
  | 'ueberfaellig'
  | 'offene-rechnungen'
  | 'rechnungen-erstellt'
  | 'personen'
  | 'top-objekt'
  | 'top-raum'
  | 'top-besteller'
  | 'naechste'
  | 'aelteste';

const TITEL: Record<StatKategorie, string> = {
  'gesamt':             'Bewirtungen gesamt',
  'abschlussquote':     'Abschlussquote',
  'monat':              'Monatsverlauf',
  'ueberfaellig':       'Überfällige Bewirtungen',
  'offene-rechnungen':  'Bereit zur Rechnungserstellung',
  'rechnungen-erstellt':'Rechnungsstatus',
  'personen':           'Personenverteilung',
  'top-objekt':         'Aktivstes Objekt',
  'top-raum':           'Meistgebuchter Raum',
  'top-besteller':      'Top Besteller',
  'naechste':           'Nächste Bewirtungen',
  'aelteste':           'Älteste Überfälligkeit',
};

interface Props { kategorie: StatKategorie; onClose: () => void; }

// ─── Color palette ───────────────────────────────────────────────────────────
const C = {
  blue:    '#0f3460',
  red:     '#e94560',
  teal:    '#a8dadc',
  green:   '#2d8a4e',
  orange:  '#e8a020',
  muted:   '#8a9bb0',
  surface: '#ffffff',
  bg:      '#f4f6f9',
};

// ─── Chart primitives ────────────────────────────────────────────────────────

/** Donut with multiple segments. segments: [{value, color, label}] */
function DonutChart({ segments, centerLabel, centerSub }: {
  segments: { value: number; color: string; label: string }[];
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className={s.leer}>Keine Daten</p>;

  const r = 70; const cx = 90; const cy = 90;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap  = circ - dash;
    const rot  = offset * 360 - 90;
    offset += pct;
    return { ...seg, dash, gap, rot };
  });

  return (
    <div className={s.chartWrap}>
      <svg viewBox="0 0 180 180" className={s.donutSvg}>
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={28}
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={0}
            transform={`rotate(${a.rot} ${cx} ${cy})`}
          />
        ))}
        {centerLabel && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="900" fill="#1a1a2e">{centerLabel}</text>
            {centerSub && <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill={C.muted}>{centerSub}</text>}
          </>
        )}
      </svg>
      <div className={s.legend}>
        {arcs.map((a, i) => (
          <div key={i} className={s.legendItem}>
            <span className={s.legendDot} style={{ background: a.color }} />
            <span className={s.legendLabel}>{a.label}</span>
            <span className={s.legendValue}>{a.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar chart */
function HBarChart({ rows, colorFn }: {
  rows: { label: string; value: number }[];
  colorFn?: (i: number) => string;
}) {
  if (rows.length === 0) return <p className={s.leer}>Keine Daten</p>;
  const max = Math.max(...rows.map(r => r.value), 1);
  const colors = [C.blue, C.teal, C.green, C.orange, C.red, '#7b68ee', '#20b2aa', '#ff7f50'];
  return (
    <div className={s.hbarList}>
      {rows.map((row, i) => {
        const pct = (row.value / max) * 100;
        const color = colorFn ? colorFn(i) : colors[i % colors.length];
        return (
          <div key={i} className={s.hbarRow}>
            <div className={s.hbarLabel}>{row.label}</div>
            <div className={s.hbarTrack}>
              <div className={s.hbarFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className={s.hbarVal}>{row.value}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Vertical bar chart for time series */
function VBarChart({ bars, yLabel }: {
  bars: { label: string; value: number; sub?: string }[];
  yLabel?: string;
}) {
  if (bars.length === 0) return <p className={s.leer}>Keine Daten</p>;
  const max = Math.max(...bars.map(b => b.value), 1);
  const H = 120; const barW = 28; const gap = 12;
  const W = bars.length * (barW + gap) + gap;
  return (
    <div className={s.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H + 36}`} className={s.vbarSvg}>
        {bars.map((b, i) => {
          const barH = (b.value / max) * H;
          const x = gap + i * (barW + gap);
          const y = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="4" fill={C.blue} opacity={0.85} />
              {b.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.blue}>{b.value}</text>
              )}
              <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill={C.muted}>{b.label}</text>
              {b.sub && <text x={x + barW / 2} y={H + 26} textAnchor="middle" fontSize="8" fill={C.muted}>{b.sub}</text>}
            </g>
          );
        })}
        {yLabel && (
          <text x={4} y={10} fontSize="9" fill={C.muted}>{yLabel}</text>
        )}
      </svg>
    </div>
  );
}

/** Timeline dots chart — shows events on a 30-day axis */
function TimelineChart({ events }: { events: { date: string; label: string; color?: string }[] }) {
  if (events.length === 0) return <p className={s.leer}>Keine bevorstehenden Bewirtungen</p>;
  return (
    <div className={s.timeline}>
      {events.map((e, i) => (
        <div key={i} className={s.tlRow}>
          <div className={s.tlDot} style={{ background: e.color ?? C.blue }} />
          <div className={s.tlDate}>{e.date}</div>
          <div className={s.tlLabel}>{e.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GFStatistikDetailScreen({ kategorie, onClose }: Props) {
  const belege = useBelegStore(st => st.belege);
  const active = useMemo(() => belege.filter(b => !b.deleted), [belege]);

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitle}>{TITEL[kategorie]}</span>
      </div>
      <div className={s.scroll}>
        <ChartContent kategorie={kategorie} active={active} />
      </div>
    </div>
  );
}

function ChartContent({ kategorie, active }: { kategorie: StatKategorie; active: Bewirtungsbeleg[] }) {
  const now     = new Date();
  const today   = format(now, 'yyyy-MM-dd');
  const nowTime = format(now, 'HH:mm');

  // ── Gesamt ─────────────────────────────────────────────────────────────────
  if (kategorie === 'gesamt') {
    const abg = active.filter(b => b.abgeschlossen).length;
    const ueberfaellig = active.filter(b => {
      if (b.abgeschlossen) return false;
      return b.cateringDatumVon < today || (b.cateringDatumVon === today && !!b.uhrzeitBis && b.uhrzeitBis < nowTime);
    }).length;
    const offen = active.filter(b => !b.abgeschlossen && !(b.cateringDatumVon < today)).length;
    const rechnungOffen = active.filter(b => b.abgeschlossen && !b.rechnungErstellt).length;
    return (
      <>
        <p className={s.subtitle}>Statusverteilung aller {active.length} Bewirtungen</p>
        <DonutChart
          segments={[
            { value: abg - rechnungOffen, color: C.green,  label: 'Abgeschlossen & Rechnung erstellt' },
            { value: rechnungOffen,        color: C.teal,   label: 'Abgeschlossen, Rechnung ausstehend' },
            { value: offen,                color: C.blue,   label: 'Offen & geplant' },
            { value: ueberfaellig,         color: C.orange, label: 'Überfällig' },
          ]}
          centerLabel={String(active.length)}
          centerSub="Gesamt"
        />
      </>
    );
  }

  // ── Abschlussquote ─────────────────────────────────────────────────────────
  if (kategorie === 'abschlussquote') {
    const abg   = active.filter(b => b.abgeschlossen).length;
    const offen = active.length - abg;
    const pct   = active.length > 0 ? Math.round((abg / active.length) * 100) : 0;
    return (
      <>
        <p className={s.subtitle}>{abg} von {active.length} Bewirtungen abgeschlossen</p>
        <DonutChart
          segments={[
            { value: abg,   color: C.green, label: 'Abgeschlossen' },
            { value: offen, color: C.muted, label: 'Noch offen' },
          ]}
          centerLabel={`${pct}%`}
          centerSub="abgeschlossen"
        />
      </>
    );
  }

  // ── Monatsverlauf ──────────────────────────────────────────────────────────
  if (kategorie === 'monat') {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const start = startOfMonth(d);
      const end   = endOfMonth(d);
      const count = active.filter(b => {
        try { return isWithinInterval(parseISO(b.cateringDatumVon), { start, end }); }
        catch { return false; }
      }).length;
      return {
        label: format(d, 'MMM', { locale: de }),
        sub:   format(d, 'yy'),
        value: count,
      };
    });
    return (
      <>
        <p className={s.subtitle}>Bewirtungen pro Monat (letzte 6 Monate)</p>
        <VBarChart bars={months} yLabel="Anzahl" />
      </>
    );
  }

  // ── Überfällige ────────────────────────────────────────────────────────────
  if (kategorie === 'ueberfaellig') {
    const liste = active
      .filter(b => !b.abgeschlossen && b.cateringDatumVon < today)
      .sort((a, b) => a.cateringDatumVon.localeCompare(b.cateringDatumVon))
      .slice(0, 12)
      .map(b => ({
        label: b.veranstaltung || b.bestellungsnummer,
        value: differenceInDays(now, parseISO(b.cateringDatumVon)),
      }));
    return (
      <>
        <p className={s.subtitle}>Tage überfällig — älteste zuerst</p>
        <HBarChart rows={liste} colorFn={() => C.orange} />
      </>
    );
  }

  // ── Offene Rechnungen ──────────────────────────────────────────────────────
  if (kategorie === 'offene-rechnungen') {
    const bereit  = active.filter(b => b.abgeschlossen && !b.rechnungErstellt).length;
    const erstellt = active.filter(b => b.rechnungErstellt).length;
    const nochOffen = active.filter(b => !b.abgeschlossen).length;

    // Bar chart: top Objekte die auf Rechnung warten
    const byObjekt: Record<string, number> = {};
    active.filter(b => b.abgeschlossen && !b.rechnungErstellt)
      .forEach(b => { byObjekt[b.objektName] = (byObjekt[b.objektName] ?? 0) + 1; });
    const objRows = Object.entries(byObjekt)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    return (
      <>
        <p className={s.subtitle}>Rechnungsstatus aller abgeschlossenen Bewirtungen</p>
        <DonutChart
          segments={[
            { value: erstellt, color: C.green,  label: 'Rechnung erstellt' },
            { value: bereit,   color: C.orange, label: 'Bereit, noch nicht erstellt' },
            { value: nochOffen, color: C.muted, label: 'Bewirtung noch offen' },
          ]}
          centerLabel={String(bereit)}
          centerSub="ausstehend"
        />
        {objRows.length > 0 && (
          <>
            <p className={s.subtitle} style={{ marginTop: 24 }}>Nach Objekt — offene Rechnungen</p>
            <HBarChart rows={objRows} colorFn={() => C.orange} />
          </>
        )}
      </>
    );
  }

  // ── Rechnungsstatus ────────────────────────────────────────────────────────
  if (kategorie === 'rechnungen-erstellt') {
    const erstellt = active.filter(b => b.rechnungErstellt).length;
    const bereit   = active.filter(b => b.abgeschlossen && !b.rechnungErstellt).length;
    const nochOffen = active.filter(b => !b.abgeschlossen).length;

    // Monatsverlauf der Rechnungserstellungen
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const start = startOfMonth(d);
      const end   = endOfMonth(d);
      const count = active.filter(b => {
        if (!b.rechnungErstelltAm) return false;
        try { return isWithinInterval(parseISO(b.rechnungErstelltAm), { start, end }); }
        catch { return false; }
      }).length;
      return { label: format(d, 'MMM', { locale: de }), sub: format(d, 'yy'), value: count };
    });

    return (
      <>
        <p className={s.subtitle}>Gesamtübersicht Rechnungen</p>
        <DonutChart
          segments={[
            { value: erstellt,  color: C.green,  label: 'Rechnung erstellt' },
            { value: bereit,    color: C.orange, label: 'Bereit, ausstehend' },
            { value: nochOffen, color: C.muted,  label: 'Noch nicht abgeschlossen' },
          ]}
          centerLabel={String(erstellt)}
          centerSub="erstellt"
        />
        <p className={s.subtitle} style={{ marginTop: 24 }}>Rechnungen erstellt pro Monat</p>
        <VBarChart bars={months} />
      </>
    );
  }

  // ── Personenverteilung ────────────────────────────────────────────────────
  if (kategorie === 'personen') {
    const buckets = [
      { label: '1–5',   min: 1,   max: 5   },
      { label: '6–15',  min: 6,   max: 15  },
      { label: '16–30', min: 16,  max: 30  },
      { label: '31–50', min: 31,  max: 50  },
      { label: '51–100',min: 51,  max: 100 },
      { label: '100+',  min: 101, max: Infinity },
    ];
    const bars = buckets.map(b => ({
      label: b.label,
      value: active.filter(x => x.personenzahl >= b.min && x.personenzahl <= b.max).length,
    }));
    const top5 = [...active]
      .filter(b => b.personenzahl > 0)
      .sort((a, b) => b.personenzahl - a.personenzahl)
      .slice(0, 5)
      .map(b => ({ label: b.veranstaltung || b.bestellungsnummer, value: b.personenzahl }));
    const avg = active.filter(b => b.personenzahl > 0);
    const avgVal = avg.length > 0
      ? Math.round(avg.reduce((s, b) => s + b.personenzahl, 0) / avg.length)
      : 0;
    return (
      <>
        <p className={s.subtitle}>Verteilung nach Personenzahl (Ø {avgVal} Pers.)</p>
        <VBarChart bars={bars} yLabel="Anzahl Bewirtungen" />
        {top5.length > 0 && (
          <>
            <p className={s.subtitle} style={{ marginTop: 24 }}>Top 5 größte Bewirtungen</p>
            <HBarChart rows={top5} colorFn={() => C.teal} />
          </>
        )}
      </>
    );
  }

  // ── Top Objekt ────────────────────────────────────────────────────────────
  if (kategorie === 'top-objekt') {
    const count: Record<string, number> = {};
    active.forEach(b => { if (b.objektName) count[b.objektName] = (count[b.objektName] ?? 0) + 1; });
    const rows = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    // Abschlussquote pro Objekt
    const quoteRows = rows.map(r => {
      const total = active.filter(b => b.objektName === r.label).length;
      const abg   = active.filter(b => b.objektName === r.label && b.abgeschlossen).length;
      return { label: `${r.label} (${Math.round((abg/total)*100)}%)`, value: abg };
    });
    return (
      <>
        <p className={s.subtitle}>Bewirtungen pro Objekt</p>
        <HBarChart rows={rows} />
        <p className={s.subtitle} style={{ marginTop: 24 }}>Abgeschlossene Bewirtungen pro Objekt</p>
        <HBarChart rows={quoteRows} colorFn={() => C.green} />
      </>
    );
  }

  // ── Top Raum ──────────────────────────────────────────────────────────────
  if (kategorie === 'top-raum') {
    const count: Record<string, number> = {};
    active.forEach(b => { if (b.raum) count[b.raum] = (count[b.raum] ?? 0) + 1; });
    const rows = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
    // Avg persons per Raum
    const avgRows = Object.keys(count).map(raum => {
      const inRaum = active.filter(b => b.raum === raum && b.personenzahl > 0);
      const avg = inRaum.length > 0 ? Math.round(inRaum.reduce((s, b) => s + b.personenzahl, 0) / inRaum.length) : 0;
      return { label: raum, value: avg };
    }).sort((a, b) => b.value - a.value).slice(0, 10);
    return (
      <>
        <p className={s.subtitle}>Bewirtungen pro Raum (Top 10)</p>
        <HBarChart rows={rows} />
        <p className={s.subtitle} style={{ marginTop: 24 }}>Ø Personenzahl pro Raum</p>
        <HBarChart rows={avgRows} colorFn={() => C.teal} />
      </>
    );
  }

  // ── Top Besteller ─────────────────────────────────────────────────────────
  if (kategorie === 'top-besteller') {
    const count: Record<string, number> = {};
    active.forEach(b => { if (b.besteller) count[b.besteller] = (count[b.besteller] ?? 0) + 1; });
    const rows = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
    return (
      <>
        <p className={s.subtitle}>Anzahl Bestellungen pro Person (Top 10)</p>
        <HBarChart rows={rows} />
      </>
    );
  }

  // ── Nächste Bewirtungen ───────────────────────────────────────────────────
  if (kategorie === 'naechste') {
    const upcoming = active
      .filter(b => !b.abgeschlossen && b.cateringDatumVon >= today)
      .sort((a, b) => a.cateringDatumVon.localeCompare(b.cateringDatumVon))
      .slice(0, 20);

    // Bar: Bewirtungen pro Tag in den nächsten 14 Tagen
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const ds = format(d, 'yyyy-MM-dd');
      const count = active.filter(b => b.cateringDatumVon === ds && !b.abgeschlossen).length;
      return {
        label: format(d, 'dd.', { locale: de }),
        sub:   format(d, 'EEE', { locale: de }),
        value: count,
      };
    });

    const events = upcoming.slice(0, 15).map(b => {
      const tage = differenceInDays(parseISO(b.cateringDatumVon), now);
      return {
        date: `${format(parseISO(b.cateringDatumVon), 'dd.MM.')} ${b.uhrzeitVon ? `· ${b.uhrzeitVon}` : ''}`,
        label: `${b.veranstaltung || b.bestellungsnummer} — ${b.objektName}`,
        color: tage === 0 ? C.red : tage <= 2 ? C.orange : C.blue,
      };
    });

    return (
      <>
        <p className={s.subtitle}>Belegte Tage — nächste 14 Tage</p>
        <VBarChart bars={days} />
        <p className={s.subtitle} style={{ marginTop: 24 }}>Bevorstehende Bewirtungen</p>
        <TimelineChart events={events} />
      </>
    );
  }

  // ── Älteste Überfälligkeit ─────────────────────────────────────────────────
  if (kategorie === 'aelteste') {
    const liste = active
      .filter(b => !b.abgeschlossen && b.cateringDatumVon < today)
      .sort((a, b) => a.cateringDatumVon.localeCompare(b.cateringDatumVon))
      .slice(0, 15);

    const events = liste.map(b => ({
      date: format(parseISO(b.cateringDatumVon), 'dd.MM.yyyy'),
      label: `${b.veranstaltung || b.bestellungsnummer} — ${b.objektName} (${differenceInDays(now, parseISO(b.cateringDatumVon))}d)`,
      color: C.orange,
    }));

    const rows = liste.slice(0, 10).map(b => ({
      label: b.veranstaltung || b.bestellungsnummer,
      value: differenceInDays(now, parseISO(b.cateringDatumVon)),
    }));

    return (
      <>
        <p className={s.subtitle}>Überfälligkeitsdauer in Tagen</p>
        <HBarChart rows={rows} colorFn={() => C.orange} />
        <p className={s.subtitle} style={{ marginTop: 24 }}>Details</p>
        <TimelineChart events={events} />
      </>
    );
  }

  return null;
}

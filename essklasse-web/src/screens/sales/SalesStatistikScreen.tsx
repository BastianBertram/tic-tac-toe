import { useMemo } from 'react';
import { format, parseISO, subMonths, startOfMonth, isWithinInterval, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { SALES_STATUS_LABEL } from '../../types';
import type { SalesStatus } from '../../types';
import { euro, euroFull, statusColor, isOffen, useSichtbareAnfragen } from './salesUtils';
import s from './SalesStatistikScreen.module.css';

const C = { blue: '#5b8def', green: '#2d8a4e', red: '#c0392b', orange: '#e8a020', teal: '#16a3a3', muted: '#8a9bb0' };

export function SalesStatistikScreen() {
  const anfragen = useSichtbareAnfragen();

  const data = useMemo(() => {
    // Funnel: Anzahl + Wert pro offener Stufe
    const offeneStufen: SalesStatus[] = ['neu', 'qualifiziert', 'angebot', 'verhandlung'];
    const funnel = offeneStufen.map(st => {
      const items = anfragen.filter(a => a.status === st);
      return { status: st, count: items.length, wert: items.reduce((s, a) => s + a.geschaetzterWert, 0) };
    });

    // Win/Loss
    const gewonnen = anfragen.filter(a => a.status === 'gewonnen');
    const verloren = anfragen.filter(a => a.status === 'verloren');

    // Umsatz pro Segment (gewonnen)
    const segWerte = {
      catering: gewonnen.filter(a => a.segment === 'catering').reduce((s, a) => s + a.geschaetzterWert, 0),
      betriebsgastronomie: gewonnen.filter(a => a.segment === 'betriebsgastronomie').reduce((s, a) => s + a.geschaetzterWert, 0),
    };

    // Top-Kunden nach Gesamtwert (gewonnen + Pipeline)
    const kundenMap = new Map<string, number>();
    anfragen.forEach(a => {
      if (a.status === 'verloren') return;
      kundenMap.set(a.kundeFirma, (kundenMap.get(a.kundeFirma) ?? 0) + a.geschaetzterWert);
    });
    const topKunden = [...kundenMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Gewonnener Umsatz letzte 6 Monate
    const now = new Date();
    const monate = Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(now, 5 - i);
      const start = startOfMonth(m), end = endOfMonth(m);
      const wert = gewonnen
        .filter(a => {
          if (!a.datum) return false;
          try { return isWithinInterval(parseISO(a.datum), { start, end }); } catch { return false; }
        })
        .reduce((s, a) => s + a.geschaetzterWert, 0);
      return { label: format(m, 'MMM', { locale: de }), wert };
    });

    const pipelineWert = anfragen.filter(isOffen).reduce((s, a) => s + a.geschaetzterWert, 0);
    const avgDeal = gewonnen.length > 0 ? gewonnen.reduce((s, a) => s + a.geschaetzterWert, 0) / gewonnen.length : 0;

    return { funnel, gewonnen: gewonnen.length, verloren: verloren.length, segWerte, topKunden, monate, pipelineWert, avgDeal };
  }, [anfragen]);

  const entschieden = data.gewonnen + data.verloren;
  const winRate = entschieden > 0 ? Math.round((data.gewonnen / entschieden) * 100) : 0;
  const maxFunnel = Math.max(1, ...data.funnel.map(f => f.count));
  const maxMonat = Math.max(1, ...data.monate.map(m => m.wert));
  const maxKunde = Math.max(1, ...data.topKunden.map(k => k[1]));
  const segMax = Math.max(1, data.segWerte.catering, data.segWerte.betriebsgastronomie);

  return (
    <div className={s.screen}>
      <div className={s.header}><span className={s.headerTitle}>📊 Vertriebsstatistik</span></div>

      <div className={s.scroll}>
        {/* KPI-Zeile */}
        <div className={s.kpiRow}>
          <div className={s.kpi}><div className={s.kpiVal}>{winRate}%</div><div className={s.kpiLabel}>Win-Rate</div></div>
          <div className={s.kpi}><div className={s.kpiVal}>{euro(data.pipelineWert)}</div><div className={s.kpiLabel}>Pipeline</div></div>
          <div className={s.kpi}><div className={s.kpiVal}>{euro(data.avgDeal)}</div><div className={s.kpiLabel}>Ø Deal</div></div>
        </div>

        {/* Funnel */}
        <Card title="Sales-Funnel" sub="Offene Anfragen je Pipeline-Stufe">
          <div className={s.funnel}>
            {data.funnel.map(f => (
              <div key={f.status} className={s.funnelRow}>
                <span className={s.funnelLabel}>{SALES_STATUS_LABEL[f.status]}</span>
                <div className={s.funnelTrack}>
                  <div className={s.funnelFill} style={{ width: `${(f.count / maxFunnel) * 100}%`, background: statusColor(f.status) }}>
                    <span className={s.funnelCount}>{f.count}</span>
                  </div>
                </div>
                <span className={s.funnelWert}>{euro(f.wert)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Win/Loss Donut */}
        <Card title="Gewonnen vs. Verloren" sub={`${entschieden} entschiedene Anfragen`}>
          {entschieden === 0 ? <p className={s.leer}>Noch keine Entscheidungen.</p> : (
            <div className={s.donutWrap}>
              <Donut won={data.gewonnen} lost={data.verloren} rate={winRate} />
              <div className={s.legend}>
                <LegendItem color={C.green} label="Gewonnen" value={String(data.gewonnen)} />
                <LegendItem color={C.red}   label="Verloren" value={String(data.verloren)} />
              </div>
            </div>
          )}
        </Card>

        {/* Umsatz pro Segment */}
        <Card title="Gewonnener Umsatz je Segment">
          <div className={s.hbarList}>
            <HBar label="Catering"            value={data.segWerte.catering}            max={segMax} color={C.orange} />
            <HBar label="Betriebsgastronomie" value={data.segWerte.betriebsgastronomie} max={segMax} color={C.teal} />
          </div>
        </Card>

        {/* Top-Kunden */}
        <Card title="Top-Kunden" sub="nach Gesamtwert (gewonnen + offen)">
          {data.topKunden.length === 0 ? <p className={s.leer}>Keine Daten.</p> : (
            <div className={s.hbarList}>
              {data.topKunden.map(([firma, wert]) => (
                <HBar key={firma} label={firma} value={wert} max={maxKunde} color={C.blue} />
              ))}
            </div>
          )}
        </Card>

        {/* Monatstrend */}
        <Card title="Gewonnener Umsatz" sub="letzte 6 Monate">
          <div className={s.vbarChart}>
            {data.monate.map((m, i) => (
              <div key={i} className={s.vbarCol}>
                <span className={s.vbarVal}>{m.wert > 0 ? euro(m.wert) : ''}</span>
                <div className={s.vbar} style={{ height: `${Math.max(2, (m.wert / maxMonat) * 100)}%`, background: C.green }} />
                <span className={s.vbarLabel}>{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className={s.card}>
      <div className={s.cardTitle}>{title}</div>
      {sub && <div className={s.cardSub}>{sub}</div>}
      <div className={s.cardBody}>{children}</div>
    </div>
  );
}

function Donut({ won, lost, rate }: { won: number; lost: number; rate: number }) {
  const total = won + lost;
  const r = 54, circ = 2 * Math.PI * r;
  const wonFrac = total > 0 ? won / total : 0;
  return (
    <svg className={s.donut} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke={C.red} strokeWidth="20" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={C.green} strokeWidth="20"
        strokeDasharray={`${circ * wonFrac} ${circ}`} transform="rotate(-90 70 70)" strokeLinecap="butt" />
      <text x="70" y="66" textAnchor="middle" fontSize="26" fontWeight="900" fill="var(--ek-charcoal)">{rate}%</text>
      <text x="70" y="86" textAnchor="middle" fontSize="11" fill={C.muted}>Win-Rate</text>
    </svg>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className={s.legendItem}>
      <span className={s.legendDot} style={{ background: color }} />
      <span className={s.legendLabel}>{label}</span>
      <span className={s.legendValue}>{value}</span>
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className={s.hbarRow}>
      <span className={s.hbarLabel}>{label}</span>
      <div className={s.hbarTrack}>
        <div className={s.hbarFill} style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className={s.hbarVal}>{euroFull(value)}</span>
    </div>
  );
}

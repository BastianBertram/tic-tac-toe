import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import {
  format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameWeek, getISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useObjektFilter } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { ObjektSwitcherButton } from '../components/ObjektSwitcher';
import { OffeneBanner } from '../components/OffeneBanner';
import type { Bewirtungsbeleg } from '../types';
import s from './WeekScreen.module.css';

interface Props { onOpenBeleg: (b: Bewirtungsbeleg) => void; onTabAbschluss: () => void; }

/** Sortierung: aufsteigend nach uhrzeitVon, leere Uhrzeiten ans Ende */
function byUhrzeit(a: Bewirtungsbeleg, b: Bewirtungsbeleg): number {
  return (a.uhrzeitVon || '99:99').localeCompare(b.uhrzeitVon || '99:99');
}

const HOUR_H = 46;          // Pixel-Höhe einer Stunde
const DEFAULT_VON = 8;      // Standard-Startstunde, wenn keine Belege
const DEFAULT_BIS = 18;     // Standard-Endstunde, wenn keine Belege

/** "HH:MM" → Minuten seit Mitternacht, sonst null */
function toMin(t?: string): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Platzierung { beleg: Bewirtungsbeleg; von: number; bis: number; lane: number; lanes: number; }

/**
 * Ordnet die Belege eines Tages überlappungsfrei in Spuren (lanes) an:
 * sich zeitlich überschneidende Belege erhalten verschiedene Spuren und werden
 * dadurch nebeneinander statt übereinander dargestellt.
 */
function platziere(dayBelege: Bewirtungsbeleg[]): Platzierung[] {
  const items = dayBelege
    .map(b => {
      const von = toMin(b.uhrzeitVon);
      if (von == null) return null;
      const bis = Math.max(toMin(b.uhrzeitBis) ?? von + 60, von + 15);
      return { beleg: b, von, bis };
    })
    .filter((x): x is { beleg: Bewirtungsbeleg; von: number; bis: number } => x != null)
    .sort((a, b) => a.von - b.von || a.bis - b.bis);

  const result: Platzierung[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = []; // Endzeit je Spur
    const laneOf = new Map<typeof cluster[number], number>();
    for (const it of cluster) {
      let lane = laneEnds.findIndex(end => end <= it.von);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.bis); }
      else laneEnds[lane] = it.bis;
      laneOf.set(it, lane);
    }
    const lanes = laneEnds.length;
    for (const it of cluster) result.push({ ...it, lane: laneOf.get(it)!, lanes });
    cluster = [];
  };

  for (const it of items) {
    if (cluster.length > 0 && it.von >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.bis);
  }
  flush();
  return result;
}

export function WeekScreen({ onOpenBeleg, onTabAbschluss }: Props) {
  const belege          = useBelegStore(st => st.belege);
  const { matchObjekt } = useObjektFilter();
  const rolle           = useAuthStore(st => st.user?.rolle);
  // offset: 0 = aktuelle Woche, -1 = vorige, +1 = nächste …
  const [offset, setOffset] = useState(0);

  const base       = addWeeks(new Date(), offset);
  const weekStart  = startOfWeek(base, { weekStartsOn: 1 }); // Montag
  const weekEnd    = endOfWeek(base,   { weekStartsOn: 1 }); // Sonntag
  const days       = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const istDieseWoche = isSameWeek(base, new Date(), { weekStartsOn: 1 });

  // Sichtbar nur Belege der dem Nutzer zugeordneten Objekte.
  const belegeForObjekt = belege.filter(b => !b.deleted && matchObjekt(b.objektId));

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');
  const weekBelege   = belegeForObjekt.filter(
    b => b.cateringDatumVon >= weekStartStr && b.cateringDatumVon <= weekEndStr
  );

  const spanLabel = `${format(weekStart, 'd.', { locale: de })}–${format(weekEnd, 'd. MMM yyyy', { locale: de })}`;

  // Stundenraster: Bereich aus den Belegen der Woche ableiten (sonst Standard).
  let minH = DEFAULT_VON, maxH = DEFAULT_BIS;
  for (const b of weekBelege) {
    const von = toMin(b.uhrzeitVon);
    const bis = toMin(b.uhrzeitBis) ?? (von != null ? von + 60 : null);
    if (von != null) minH = Math.min(minH, Math.floor(von / 60));
    if (bis != null) maxH = Math.max(maxH, Math.ceil(bis / 60));
  }
  minH = Math.max(0, minH);
  maxH = Math.min(24, Math.max(maxH, minH + 1));
  const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
  const gridHeight = (maxH - minH) * HOUR_H;

  return (
    <div className={s.screen}>
      {/* ── Header ── */}
      <div className={s.header}>
        <BrandLogo className={s.logo} />
        <span className={s.headerSection}>🗓️ Woche</span>
        {rolle !== 'geschaeftsfuehrung' && (
          <div className={s.headerRight}>
            <ObjektSwitcherButton />
          </div>
        )}
      </div>

      <OffeneBanner onTabSwitch={onTabAbschluss} />

      {/* ── Wochen-Navigator ── */}
      <div className={s.weekNav}>
        <button className={s.navBtn} onClick={() => setOffset(o => o - 1)} type="button" aria-label="Vorige Woche">‹</button>
        <div className={s.weekLabelWrap}>
          <span className={s.weekKw}>KW {getISOWeek(weekStart)}</span>
          <span className={s.weekSpan}>{spanLabel}</span>
        </div>
        <button className={s.navBtn} onClick={() => setOffset(o => o + 1)} type="button" aria-label="Nächste Woche">›</button>
      </div>

      {offset !== 0 && (
        <button className={s.backToWeek} onClick={() => setOffset(0)} type="button">
          ↩ Zurück zu dieser Woche
        </button>
      )}

      {/* ── Kopfzeile: leere Ecke + Wochentage Mo–So ── */}
      <div className={s.headRow}>
        <div className={s.gutterHead} />
        {days.map(day => {
          const heute = isToday(day);
          return (
            <div key={format(day, 'yyyy-MM-dd')} className={`${s.dayHeader} ${heute ? s.dayHeaderToday : ''}`}>
              <span className={s.dayName}>{format(day, 'EEEEEE', { locale: de })}</span>
              <span className={s.dayNum}>{format(day, 'd.M.', { locale: de })}</span>
            </div>
          );
        })}
      </div>

      {/* ── Stundenraster: links Stunden, rechts 7 Tagesspalten ── */}
      <div className={s.gridScroll}>
        <div className={s.grid} style={{ height: gridHeight }}>
          {/* Stunden-Beschriftung links */}
          <div className={s.gutter}>
            {hours.map(h => (
              <div key={h} className={s.hourLabel} style={{ top: (h - minH) * HOUR_H }}>
                {h}:00
              </div>
            ))}
          </div>

          {/* 7 Tagesspalten */}
          {days.map(day => {
            const key       = format(day, 'yyyy-MM-dd');
            const dayBelege = weekBelege.filter(b => b.cateringDatumVon === key).toSorted(byUhrzeit);
            const heute     = isToday(day);
            return (
              <div key={key} className={`${s.dayCol} ${heute ? s.dayColToday : ''}`}>
                {/* Stundenlinien */}
                {hours.map(h => (
                  <div key={h} className={s.hourLine} style={{ top: (h - minH) * HOUR_H }} />
                ))}
                {/* Bewirtungen als Zeitblöcke — überlappende nebeneinander */}
                {platziere(dayBelege).map(({ beleg: b, von, bis, lane, lanes }) => {
                  const top = (von - minH * 60) / 60 * HOUR_H;
                  const height = Math.max((bis - von) / 60 * HOUR_H, 22);
                  const left = `calc(${(lane / lanes) * 100}% + 2px)`;
                  const width = `calc(${100 / lanes}% - 4px)`;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`${s.entry} ${b.abgeschlossen ? s.entryDone : ''}`}
                      style={{ top, height, left, width }}
                      onClick={() => onOpenBeleg(b)}
                      title={`${b.uhrzeitVon}–${b.uhrzeitBis || ''} · ${b.veranstaltung || 'Bewirtung'}`}
                    >
                      <span className={s.entryTime}>{b.uhrzeitVon}</span>
                      <span className={s.entryTitle}>{b.veranstaltung || 'Bewirtung'}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

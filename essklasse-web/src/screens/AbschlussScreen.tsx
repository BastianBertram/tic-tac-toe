import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { useAuthStore }  from '../store/authStore';
import type { Bewirtungsbeleg, AbschlussPosition } from '../types';
import s from './AbschlussScreen.module.css';

interface Props {
  beleg: Bewirtungsbeleg;
  onClose: () => void;
  onDone: () => void;
}

export function AbschlussScreen({ beleg, onClose, onDone }: Props) {
  const schliesseBeleg = useBelegStore(st => st.schliesseBeleg);
  const user = useAuthStore(st => st.user);

  // Mengen: initial = geplante Menge
  const [mengen, setMengen] = useState<Record<string, string>>(
    Object.fromEntries(beleg.positionen.map(p => [p.id, String(p.menge)]))
  );
  const [done, setDone] = useState(false);

  function setMenge(id: string, val: string) {
    setMengen(prev => ({ ...prev, [id]: val }));
  }

  function handleAbschliessen() {
    const positionen: AbschlussPosition[] = beleg.positionen.map(p => ({
      positionId: p.id,
      tatsaechlicheMenge: parseFloat(mengen[p.id] ?? String(p.menge)) || 0,
    }));
    schliesseBeleg(beleg.id, positionen, user?.name ?? user?.email);
    setDone(true);
  }

  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });

  if (done) {
    return (
      <div className={s.screen}>
        <div className={s.successBox}>
          <div className={s.successIcon}>✅</div>
          <h2 className={s.successTitle}>Abgeschlossen!</h2>
          <p className={s.successText}>
            Die Bewirtung wurde erfolgreich abgeschlossen<br />und die Mengen wurden gespeichert.
          </p>
          <button className={s.doneBtn} onClick={onDone} type="button">Fertig</button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.screen}>
      {/* Header */}
      <div className={s.header}>
        <button className={s.backBtn} onClick={onClose} type="button">✕</button>
        <div className={s.headerCenter}>
          <div className={s.headerTitle}>Bewirtung abschließen</div>
          <div className={s.headerSub}>{beleg.veranstaltung || 'Bewirtung'}</div>
        </div>
      </div>

      <div className={s.scroll}>
        {/* Info-Banner */}
        <div className={s.infoBanner}>
          <div className={s.infoBannerIcon}>📋</div>
          <div>
            <div className={s.infoBannerTitle}>{beleg.veranstaltung || 'Bewirtung'}</div>
            <div className={s.infoBannerMeta}>
              {datum} · {beleg.uhrzeitVon}–{beleg.uhrzeitBis} · {beleg.raum || beleg.ort}
            </div>
          </div>
        </div>

        {/* Hinweis */}
        <div className={s.hinweis}>
          💡 Tragen Sie die <strong>tatsächlich verbrauchten Mengen</strong> ein.
          Weicht nichts ab, können Sie die voreingetragenen Werte übernehmen.
        </div>

        {/* Positionen */}
        {beleg.positionen.length === 0 ? (
          <div className={s.noPosBox}>
            <p>Keine Positionen vorhanden — Bewirtung kann direkt abgeschlossen werden.</p>
          </div>
        ) : (
          <div className={s.posListe}>
            <div className={s.posHeader}>
              <div className={s.posHeaderName}>Positionen</div>
              <div className={s.posHeaderCol}>Bestellte Anzahl</div>
              <div className={s.posHeaderCol}>Tatsächlich</div>
            </div>
            {Object.entries(
              beleg.positionen.reduce<Record<string, typeof beleg.positionen>>((acc, p) => {
                (acc[p.kategorie] ??= []).push(p);
                return acc;
              }, {})
            ).map(([kategorie, positionen]) => (
              <div key={kategorie} className={s.posGruppe}>
                <div className={s.posGruppeTitle}>{kategorie}</div>
                {positionen.map(p => {
                  const geplant = p.menge;
                  const tatsaechlich = parseFloat(mengen[p.id] ?? String(p.menge)) || 0;
                  const abweichend = tatsaechlich !== geplant;
                  return (
                    <div key={p.id} className={`${s.posRow} ${abweichend ? s.posRowAbweichend : ''}`}>
                      <div className={s.posName}>{p.bezeichnung}</div>
                      <div className={s.posQty}>{geplant} {p.einheit}</div>
                      <div className={s.posActCell}>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className={`${s.mengeInput} ${abweichend ? s.mengeInputAbweichend : ''}`}
                          value={mengen[p.id] ?? String(p.menge)}
                          onChange={e => setMenge(p.id, e.target.value)}
                        />
                        {abweichend && (
                          <span className={s.diffBadge}>
                            {tatsaechlich > geplant ? `+${(tatsaechlich - geplant).toFixed(1)}` : `${(tatsaechlich - geplant).toFixed(1)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Zusammenfassung Abweichungen */}
        {beleg.positionen.some(p => parseFloat(mengen[p.id] ?? String(p.menge)) !== p.menge) && (
          <div className={s.abweichungBox}>
            <div className={s.abweichungTitle}>⚠️ Abweichungen</div>
            {beleg.positionen
              .filter(p => parseFloat(mengen[p.id] ?? String(p.menge)) !== p.menge)
              .map(p => {
                const tats = parseFloat(mengen[p.id] ?? String(p.menge)) || 0;
                const diff = tats - p.menge;
                return (
                  <div key={p.id} className={s.abweichungRow}>
                    <span>{p.bezeichnung}</span>
                    <span>{p.menge} → {tats} {p.einheit}
                      <span className={diff > 0 ? s.diffPos : s.diffNeg}>
                        {' '}({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                      </span>
                    </span>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* Abschließen-Button */}
        <button className={s.abschlussBtn} onClick={handleAbschliessen} type="button">
          ✓ Bewirtung jetzt abschließen
        </button>

        <button className={s.cancelBtn} onClick={onClose} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

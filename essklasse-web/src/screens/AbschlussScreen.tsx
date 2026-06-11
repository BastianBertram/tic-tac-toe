import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { useBelegStore } from '../store/belegStore';
import { useAuthStore }  from '../store/authStore';
import { PhotoCapture } from '../components/PhotoCapture';
import { extractAbschluss } from '../services/ocrService';
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

  const [fotos, setFotos] = useState<string[]>([]);
  const [mengen,       setMengen]       = useState<Record<string, string>>(Object.fromEntries(beleg.positionen.map(p => [p.id, String(p.menge)])));
  const [zurueckVoll,  setZurueckVoll]  = useState<Record<string, string>>(Object.fromEntries(beleg.positionen.map(p => [p.id, ''])));
  const [zurueckLeer,  setZurueckLeer]  = useState<Record<string, string>>(Object.fromEntries(beleg.positionen.map(p => [p.id, ''])));
  const [pfand,        setPfand]        = useState<Record<string, string>>(Object.fromEntries(beleg.positionen.map(p => [p.id, ''])));
  const [berechnen,    setBerechnen]    = useState<Record<string, string>>(Object.fromEntries(beleg.positionen.map(p => [p.id, ''])));
  const [,             setScanning]     = useState(false);
  const [scanMsg,      setScanMsg]      = useState('');
  const [done, setDone] = useState(false);

  async function handleFotosChange(urls: string[]) {
    setFotos(urls);
    const newUrl = urls.find(u => !fotos.includes(u));
    if (!newUrl) return;
    setScanning(true);
    setScanMsg('📋 Beleg wird analysiert …');
    try {
      const extracted = await extractAbschluss(newUrl, beleg.positionen);
      extracted.forEach(ex => {
        const pos = beleg.positionen.find(p =>
          p.bezeichnung.toLowerCase().includes(ex.bezeichnung.toLowerCase()) ||
          ex.bezeichnung.toLowerCase().includes(p.bezeichnung.toLowerCase())
        );
        if (!pos) return;
        if (ex.ausgeliefert != null) setMengen(prev => ({ ...prev, [pos.id]: String(ex.ausgeliefert) }));
        if (ex.zurueckVoll  != null) setZurueckVoll(prev => ({ ...prev, [pos.id]: String(ex.zurueckVoll) }));
        if (ex.zurueckLeer  != null) setZurueckLeer(prev => ({ ...prev, [pos.id]: String(ex.zurueckLeer) }));
        if (ex.pfand        != null) setPfand(prev => ({ ...prev, [pos.id]: String(ex.pfand) }));
        if (ex.berechnen    != null) setBerechnen(prev => ({ ...prev, [pos.id]: String(ex.berechnen) }));
      });
      setScanMsg(`✅ ${extracted.length} Position(en) erkannt und übernommen`);
      setTimeout(() => setScanMsg(''), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isQuota = msg.includes('529') || msg.includes('credit') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('balance') || msg.includes('rate') || msg.includes('overloaded');
      if (isQuota) {
        setScanMsg('❌ KI-Budget aufgebraucht — Bitte Mengen manuell eintragen.');
      } else {
        setScanMsg(`⚠️ Beleg konnte nicht gescannt werden — bitte Mengen manuell eintragen. (${msg})`);
      }
      setTimeout(() => setScanMsg(''), 8000);
    } finally {
      setScanning(false);
    }
  }

  function setMenge(id: string, val: string) { setMengen(prev => ({ ...prev, [id]: val })); }

  function handleAbschliessen() {
    const positionen: AbschlussPosition[] = beleg.positionen.map(p => ({
      positionId: p.id,
      tatsaechlicheMenge: parseFloat(mengen[p.id] ?? String(p.menge)) || 0,
      zurueckVoll:  parseFloat(zurueckVoll[p.id] ?? '0') || 0,
      zurueckLeer:  parseFloat(zurueckLeer[p.id] ?? '0') || 0,
      berechnen:    parseFloat(berechnen[p.id] ?? '0') || 0,
      pfand:        parseFloat(pfand[p.id] ?? '0') || 0,
    }));
    schliesseBeleg(beleg.id, positionen, user?.name ?? user?.email, fotos);
    setDone(true);
  }

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
        <button className={s.closeBtn} onClick={onClose} type="button">✕</button>
        <BrandLogo className={s.headerLogo} />
        <button
          className={s.abschliessenHdrBtn}
          onClick={fotos.length > 0 ? handleAbschliessen : undefined}
          disabled={fotos.length === 0}
          type="button"
        >
          Abschließen
        </button>
      </div>

      <div className={s.scroll}>
        {/* Finaler Bewirtungsbeleg-Foto — Pflichtfeld */}
        <div className={s.section}>
          <PhotoCapture
            dataUrls={fotos}
            onChange={handleFotosChange}
            label="📋 Finaler Bewirtungsbeleg (Pflichtfeld)"
          />
          {fotos.length === 0 && (
            <div className={s.fotoHinweis}>
              ⚠️ Bitte fotografieren oder laden Sie den überarbeiteten Bewirtungsbeleg hoch, bevor Sie abschließen.
            </div>
          )}
          {scanMsg && (
            <div className={`${s.scanMsg} ${scanMsg.startsWith('✅') ? s.scanOk : scanMsg.startsWith('⚠️') ? s.scanErr : s.scanInfo}`}>
              {scanMsg}
            </div>
          )}
        </div>

        {/* Hinweis */}
        <div className={s.hinweis}>
          💡 Tragen Sie die <strong>tatsächlich verbrauchten Mengen</strong> ein.
          Weicht nichts ab, können Sie die voreingetragenen Werte übernehmen.
        </div>

        <div className={s.hinweisKI}>
          ⚠️ Bitte prüfen: Die KI-erkannten Positionen dienen nur als Hilfe. Maßgeblich ist immer der originale Bewirtungsschein — Positionen ggf. korrigieren, ergänzen oder löschen.
        </div>

        {/* Positionen */}
        {beleg.positionen.length === 0 ? (
          <div className={s.noPosBox}>
            <p>Keine Positionen vorhanden — Bewirtung kann direkt abgeschlossen werden.</p>
          </div>
        ) : (
          <div className={s.section}>
          <div className={s.sectionTitle}>Positionen / Leistungen</div>
          <div className={s.posListe}>
            <div className={s.posHeader}>
              <div className={s.posHeaderName}>Positionen</div>
              <div className={s.posHeaderBestellt}>Bestellt</div>
              <div className={s.posHeaderAusgeliefert}>Ausgeliefert</div>
              <div className={s.posHeaderZurueck}>Zurück</div>
              <div className={s.posHeaderVoll}>Voll</div>
              <div className={s.posHeaderLeer}>Leer</div>
              <div className={s.posHeaderBerechnen}>Berechnen</div>
              <div className={s.posHeaderPfand}>Pfand</div>
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
                      <div className={s.posQty}>{geplant}</div>
                      <div className={s.posCell}>
                        <input type="number" min="0" step="0.5"
                          className={`${s.mengeInput} ${abweichend ? s.mengeInputAbweichend : ''}`}
                          value={mengen[p.id] ?? String(p.menge)}
                          onChange={e => setMenge(p.id, e.target.value)}
                        />
                      </div>
                      <div className={s.posCell}>
                        <input type="number" min="0" step="1" className={s.mengeInput}
                          value={zurueckVoll[p.id]} placeholder="0"
                          onChange={e => setZurueckVoll(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </div>
                      <div className={s.posCell}>
                        <input type="number" min="0" step="1" className={s.mengeInput}
                          value={zurueckLeer[p.id]} placeholder="0"
                          onChange={e => setZurueckLeer(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </div>
                      <div className={s.posCell}>
                        <input type="number" min="0" step="1" className={s.mengeInput}
                          value={berechnen[p.id]} placeholder="0"
                          onChange={e => setBerechnen(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </div>
                      <div className={s.posCell}>
                        <input type="number" min="0" step="1" className={s.mengeInput}
                          value={pfand[p.id]} placeholder="0"
                          onChange={e => setPfand(prev => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
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
        <button
          className={`${s.abschlussBtn} ${fotos.length === 0 ? s.abschlussBtnDisabled : ''}`}
          onClick={fotos.length > 0 ? handleAbschliessen : undefined}
          type="button"
          disabled={fotos.length === 0}
          title={fotos.length === 0 ? 'Bitte zuerst den finalen Bewirtungsbeleg hochladen' : undefined}
        >
          ✓ Bewirtung jetzt abschließen
        </button>

        <button className={s.cancelBtn} onClick={onClose} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

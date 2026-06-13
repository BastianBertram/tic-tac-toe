import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { EINHEITEN } from '../../types';
import type { AngebotPosition } from '../../types';
import { useAngeboteStore, posGesamt } from '../../store/angeboteStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSichtbareObjekte, useObjektStore } from '../../store/objektStore';
import { naechsteNummer } from '../../services/dataService';
import { euroFull } from './salesUtils';
import { useAktiveProdukte } from './angebotUtils';
import s from './AngeboteScreen.module.css';

/** Vorbefüllung beim Anlegen aus einem Lead heraus. */
export interface AngebotVorlage {
  objektId?: string;
  anfrageId?: string;
  kundeFirma?: string;
  ansprechpartner?: string;
  email?: string;
  telefon?: string;
  betreff?: string;
}

interface Props {
  /** Vorhandenes Angebot bearbeiten, sonst neu anlegen. */
  angebotId?: string | null;
  vorlage?: AngebotVorlage;
  onClose: () => void;
  onSaved: (id: string) => void;
}

type PosEntwurf = Omit<AngebotPosition, 'gesamt'>;

export function AngebotEditorScreen({ angebotId, vorlage, onClose, onSaved }: Props) {
  const addAngebot    = useAngeboteStore(st => st.addAngebot);
  const updateAngebot = useAngeboteStore(st => st.updateAngebot);
  const bestehend     = useAngeboteStore(st => angebotId ? st.angebote.find(a => a.id === angebotId) : undefined);
  const limit         = useSettingsStore(st => st.rabattLimitProzent);
  const katalog       = useAktiveProdukte();

  const objekte       = useSichtbareObjekte();
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt()) ?? objekte[0] ?? null;

  const [objektId, setObjektId]   = useState(bestehend?.objektId ?? vorlage?.objektId ?? aktivesObjekt?.id ?? '');
  const [kundeFirma, setKunde]    = useState(bestehend?.kundeFirma ?? vorlage?.kundeFirma ?? '');
  const [ansprechpartner, setAP]  = useState(bestehend?.ansprechpartner ?? vorlage?.ansprechpartner ?? '');
  const [email, setEmail]         = useState(bestehend?.email ?? vorlage?.email ?? '');
  const [telefon, setTelefon]     = useState(bestehend?.telefon ?? vorlage?.telefon ?? '');
  const [betreff, setBetreff]     = useState(bestehend?.betreff ?? vorlage?.betreff ?? '');
  const [einleitung, setEinl]     = useState(bestehend?.einleitung ?? '');
  const [zahlung, setZahlung]     = useState(bestehend?.zahlungsbedingungen ?? 'Zahlbar innerhalb von 14 Tagen netto.');
  const [lieferung, setLieferung] = useState(bestehend?.lieferbedingungen ?? '');
  const [gueltigBis, setGueltig]  = useState(bestehend?.gueltigBis ?? '');
  const [rabattGesamt, setRabattGesamt] = useState(String(bestehend?.rabattGesamtProzent ?? ''));
  const [positionen, setPositionen]     = useState<PosEntwurf[]>(
    (bestehend?.positionen ?? []).filter(p => !p.geloescht).map(p => ({ ...p }))
  );
  const [katalogOffen, setKatalogOffen] = useState(false);
  const [katalogSuche, setKatalogSuche] = useState('');

  const rgProzent = Math.max(0, Math.min(100, Number(rabattGesamt) || 0));

  const { netto, endpreis, maxRabatt } = useMemo(() => {
    const netto = positionen.reduce((sum, p) => sum + posGesamt(p), 0);
    const endpreis = Math.round((netto * (1 - rgProzent / 100)) * 100) / 100;
    const posMax = positionen.reduce((m, p) => Math.max(m, p.rabattProzent ?? 0), 0);
    return { netto, endpreis, maxRabatt: Math.max(posMax, rgProzent) };
  }, [positionen, rgProzent]);

  const freigabeNoetig = maxRabatt > limit;
  const canSave = kundeFirma.trim() && betreff.trim() && objektId;

  const katalogGefiltert = useMemo(() => {
    const q = katalogSuche.trim().toLowerCase();
    return q ? katalog.filter(p => p.bezeichnung.toLowerCase().includes(q) || p.kategorie.toLowerCase().includes(q)) : katalog;
  }, [katalog, katalogSuche]);

  function ausKatalog(produktId: string) {
    const p = katalog.find(x => x.id === produktId);
    if (!p) return;
    setPositionen(ps => [...ps, { id: uuidv4(), produktId: p.id, bezeichnung: p.bezeichnung, einheit: p.einheit, menge: 1, einzelpreis: p.basispreis }]);
  }
  function freiePosition() {
    setPositionen(ps => [...ps, { id: uuidv4(), bezeichnung: '', einheit: 'Stk', menge: 1, einzelpreis: 0 }]);
  }
  function patchPos(id: string, partial: Partial<PosEntwurf>) {
    setPositionen(ps => ps.map(p => p.id === id ? { ...p, ...partial } : p));
  }
  function removePos(id: string) {
    setPositionen(ps => ps.filter(p => p.id !== id));
  }

  async function save() {
    if (!canSave) return;
    const felder = {
      objektId,
      anfrageId: bestehend?.anfrageId ?? vorlage?.anfrageId,
      kundeFirma: kundeFirma.trim(),
      ansprechpartner: ansprechpartner.trim(),
      email: email.trim(),
      telefon: telefon.trim(),
      betreff: betreff.trim(),
      einleitung: einleitung.trim(),
      zahlungsbedingungen: zahlung.trim(),
      lieferbedingungen: lieferung.trim(),
      gueltigBis: gueltigBis || undefined,
      rabattGesamtProzent: rgProzent || undefined,
      positionen: positionen.map(p => ({ ...p, gesamt: posGesamt(p) })),
    };
    if (bestehend) {
      updateAngebot(bestehend.id, felder);
      onSaved(bestehend.id);
    } else {
      const year = (gueltigBis || new Date().toISOString().slice(0, 10)).slice(2, 4);
      const serverNummer = await naechsteNummer('angebot', year);
      const id = addAngebot(felder, serverNummer ?? undefined);
      onSaved(id);
    }
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitleAbs}>{bestehend ? bestehend.nummer : 'Neues Angebot'}</span>
      </div>

      <div className={s.scroll}>
        {objekte.length > 1 && (
          <>
            <label className={s.label}>Objekt *</label>
            <select className={s.input} value={objektId} onChange={e => setObjektId(e.target.value)}>
              {objekte.map(o => <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ` : ''}{o.name}</option>)}
            </select>
          </>
        )}

        <label className={s.label}>Kunde / Firma *</label>
        <input className={s.input} value={kundeFirma} onChange={e => setKunde(e.target.value)} placeholder="z.B. TechNova GmbH" />

        <label className={s.label}>Betreff *</label>
        <input className={s.input} value={betreff} onChange={e => setBetreff(e.target.value)} placeholder="z.B. Catering Sommerfest 2026" />

        <label className={s.label}>Ansprechpartner</label>
        <input className={s.input} value={ansprechpartner} onChange={e => setAP(e.target.value)} placeholder="Name" />

        <div className={s.twoCol}>
          <div>
            <label className={s.label}>E-Mail</label>
            <input className={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kontakt@…" />
          </div>
          <div>
            <label className={s.label}>Telefon</label>
            <input className={s.input} value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="0511 …" />
          </div>
        </div>

        {/* ── Positionen ── */}
        <div className={s.sectionLabel}>Positionen</div>

        <div className={s.katalog}>
          <button type="button" className={s.addFrei} onClick={() => setKatalogOffen(o => !o)}>
            {katalogOffen ? '▲ Produktkatalog schließen' : '▼ Aus Produktkatalog hinzufügen'}
          </button>
          {katalogOffen && (
            <>
              <input className={s.suche} style={{ marginTop: 8 }} type="search" placeholder="🔍 Produkt suchen…"
                value={katalogSuche} onChange={e => setKatalogSuche(e.target.value)} />
              <div className={s.katalogList}>
                {katalogGefiltert.length === 0 && <div className={s.katalogLeer}>Keine Produkte im Katalog.</div>}
                {katalogGefiltert.map(p => (
                  <button key={p.id} type="button" className={s.katalogItem} onClick={() => ausKatalog(p.id)}>
                    <span className={s.katalogName}>{p.bezeichnung}<br /><span className={s.posLineSub}>{p.kategorie}</span></span>
                    <span className={s.katalogPreis}>{euroFull(p.basispreis)} / {p.einheit}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {positionen.map(p => (
          <div key={p.id} className={s.posRow}>
            <div className={s.posTop}>
              <input className={s.posName} value={p.bezeichnung} placeholder="Bezeichnung"
                onChange={e => patchPos(p.id, { bezeichnung: e.target.value })} />
              <button type="button" className={s.posDel} onClick={() => removePos(p.id)}>✕</button>
            </div>
            <div className={s.posGrid}>
              <div className={s.posCell}>
                <span className={s.posCellLabel}>Menge</span>
                <input className={s.posInput} type="number" inputMode="decimal" value={p.menge}
                  onChange={e => patchPos(p.id, { menge: Number(e.target.value) || 0 })} />
              </div>
              <div className={s.posCell}>
                <span className={s.posCellLabel}>Einheit</span>
                <select className={s.posInput} value={p.einheit} onChange={e => patchPos(p.id, { einheit: e.target.value })}>
                  {EINHEITEN.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className={s.posCell}>
                <span className={s.posCellLabel}>Preis €</span>
                <input className={s.posInput} type="number" inputMode="decimal" value={p.einzelpreis}
                  onChange={e => patchPos(p.id, { einzelpreis: Number(e.target.value) || 0 })} />
              </div>
              <div className={s.posCell}>
                <span className={s.posCellLabel}>Rabatt %</span>
                <input className={s.posInput} type="number" inputMode="decimal" value={p.rabattProzent ?? ''}
                  onChange={e => patchPos(p.id, { rabattProzent: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className={s.posGesamt}>{euroFull(posGesamt(p))}</div>
          </div>
        ))}
        <button type="button" className={s.addFrei} onClick={freiePosition}>+ Freie Position</button>

        {/* ── Konditionen ── */}
        <div className={s.sectionLabel}>Konditionen</div>
        <div className={s.twoCol}>
          <div>
            <label className={s.label}>Gesamtrabatt %</label>
            <input className={s.input} type="number" inputMode="decimal" value={rabattGesamt}
              onChange={e => setRabattGesamt(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={s.label}>Gültig bis</label>
            <input className={s.input} type="date" value={gueltigBis} onChange={e => setGueltig(e.target.value)} />
          </div>
        </div>

        <label className={s.label}>Einleitung</label>
        <textarea className={s.textarea} rows={2} value={einleitung} onChange={e => setEinl(e.target.value)} placeholder="Anschreiben / Einleitungstext…" />
        <label className={s.label}>Zahlungsbedingungen</label>
        <input className={s.input} value={zahlung} onChange={e => setZahlung(e.target.value)} />
        <label className={s.label}>Lieferbedingungen</label>
        <input className={s.input} value={lieferung} onChange={e => setLieferung(e.target.value)} placeholder="z.B. Lieferung frei Haus" />

        {/* ── Live-Vorschau ── */}
        <div className={s.summary}>
          <div className={s.sumRow}><span>Netto-Summe</span><span>{euroFull(netto)}</span></div>
          {rgProzent > 0 && <div className={s.sumRow}><span>Gesamtrabatt {rgProzent}%</span><span>−{euroFull(netto - endpreis)}</span></div>}
          <div className={`${s.sumRow} ${s.sumTotal}`}><span>Endpreis</span><span>{euroFull(endpreis)}</span></div>
        </div>

        {freigabeNoetig && (
          <div className={s.warnBox}>
            ⚠ Rabatt {maxRabatt}% übersteigt das Limit von {limit}%. Das Angebot benötigt eine Freigabe durch die Geschäftsführung, bevor es versendet werden kann.
          </div>
        )}

        <button type="button" className={s.save} disabled={!canSave} onClick={save}>
          {bestehend ? 'Änderungen speichern' : 'Angebot anlegen'}
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import { useObjektStore } from '../store/objektStore';
import { useAuthStore } from '../store/authStore';
import { PhotoCapture } from '../components/PhotoCapture';
import { PositionEditor } from '../components/PositionEditor';
import type { BelegPosition, Bewirtungsbeleg, Kategorie } from '../types';
import { KATEGORIEN as KATEGORIEN_LIST } from '../types';
import type { ExtractedBeleg } from '../services/ocrService';
import { generateErsatzBelegPdf } from '../services/belegPdf';
import s from './NewBelegScreen.module.css';

interface Props { onClose: () => void; editBeleg?: Bewirtungsbeleg; }

const today = format(new Date(), 'yyyy-MM-dd');

const INIT = {
  besteller: '', cateringDatumVon: today, cateringDatumBis: today,
  uhrzeitVon: '', uhrzeitBis: '', veranstaltung: '', ort: '', raum: '',
  personenzahl: '', konto: '', kostenstelle: '', kostentraeger: '',
  positionen: [] as BelegPosition[], fotoDataUrls: [] as string[],
  wuensche: '', interneNotiz: '',
  rechnungsanschriftFirma: '', rechnungsanschriftZuHaenden: '',
  rechnungsanschriftStrasse: '', rechnungsanschriftPlzOrt: '',
  rechnungsanschriftAnlass: '', rechnungsanschriftTeilnehmer: '', rechnungsanschriftTelefon: '',
};

function initFromBeleg(b: Bewirtungsbeleg) {
  return {
    besteller: b.besteller, cateringDatumVon: b.cateringDatumVon, cateringDatumBis: b.cateringDatumBis,
    uhrzeitVon: b.uhrzeitVon, uhrzeitBis: b.uhrzeitBis, veranstaltung: b.veranstaltung,
    ort: b.ort, raum: b.raum, personenzahl: String(b.personenzahl),
    konto: b.konto, kostenstelle: b.kostenstelle, kostentraeger: b.kostentraeger,
    positionen: b.positionen, fotoDataUrls: b.fotoDataUrls,
    wuensche: b.wuensche, interneNotiz: b.interneNotiz,
    rechnungsanschriftFirma: b.rechnungsanschriftFirma ?? '',
    rechnungsanschriftZuHaenden: b.rechnungsanschriftZuHaenden ?? '',
    rechnungsanschriftStrasse: b.rechnungsanschriftStrasse ?? '',
    rechnungsanschriftPlzOrt: b.rechnungsanschriftPlzOrt ?? '',
    rechnungsanschriftAnlass: b.rechnungsanschriftAnlass ?? '',
    rechnungsanschriftTeilnehmer: b.rechnungsanschriftTeilnehmer ?? '',
    rechnungsanschriftTelefon: b.rechnungsanschriftTelefon ?? '',
  };
}

export function NewBelegScreen({ onClose, editBeleg }: Props) {
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt());
  const objekte       = useObjektStore(st => st.objekte);
  const currentRolle  = useAuthStore(st => st.user?.rolle);
  const showRechnung  = currentRolle !== 'user';

  const [f, setF] = useState(editBeleg ? initFromBeleg(editBeleg) : INIT);
  const [saving, setSaving] = useState(false);
  const [selectedObjektId, setSelectedObjektId] = useState<string>(editBeleg?.objektId ?? aktivesObjekt?.id ?? '');
  const addBeleg = useBelegStore(s => s.addBeleg);
  const currentUser = useAuthStore(st => st.user);
  const updateBeleg = useBelegStore(s => s.updateBeleg);

  function set<K extends keyof typeof INIT>(key: K, val: (typeof INIT)[K]) {
    setF(prev => ({ ...prev, [key]: val }));
  }

  // Ein Bewirtungsbeleg muss hochgeladen werden – es sei denn, alle Bestelldaten
  // sind ausgefüllt UND mindestens eine Position wurde hinzugefügt.
  const bestelldatenFelder: [string, boolean][] = [
    ['Besteller', !!f.besteller.trim()],
    ['Veranstaltung', !!f.veranstaltung.trim()],
    ['Datum von', !!f.cateringDatumVon],
    ['Datum bis', !!f.cateringDatumBis],
    ['Uhrzeit von', !!f.uhrzeitVon],
    ['Uhrzeit bis', !!f.uhrzeitBis],
    ['Ort', !!f.ort.trim()],
    ['Raum', !!f.raum.trim()],
    ['Personenzahl', (parseInt(f.personenzahl) || 0) > 0],
  ];
  const hatPositionen      = f.positionen.length > 0;
  const bestelldatenOffen  = bestelldatenFelder.filter(([, ok]) => !ok).map(([name]) => name);
  const manuellVollstaendig = bestelldatenOffen.length === 0 && hatPositionen;
  const hatDokument        = f.fotoDataUrls.length > 0;
  const belegOk            = hatDokument || manuellVollstaendig;
  const fehlendManuell     = [...bestelldatenOffen, ...(hatPositionen ? [] : ['mindestens eine Position'])];

  function applyExtracted(data: ExtractedBeleg) {
    const extractedPositionen: BelegPosition[] = (data.positionen ?? []).map(p => ({
      id: uuidv4(),
      kategorie: (KATEGORIEN_LIST.includes(p.kategorie as Kategorie) ? p.kategorie : 'Sonstiges') as Kategorie,
      bezeichnung: p.bezeichnung,
      einheit: p.einheit || 'Stk',
      preis: p.preis ?? 0,
      menge: p.menge ?? 1,
    }));

    setF(prev => ({
      ...prev,
      ...(data.besteller        && { besteller:        data.besteller }),
      ...(data.cateringDatumVon && { cateringDatumVon: data.cateringDatumVon }),
      cateringDatumBis: data.cateringDatumBis || data.cateringDatumVon || prev.cateringDatumBis,
      ...(data.uhrzeitVon       && { uhrzeitVon:       data.uhrzeitVon }),
      ...(data.uhrzeitBis       && { uhrzeitBis:       data.uhrzeitBis }),
      ...(data.veranstaltung    && { veranstaltung:    data.veranstaltung }),
      ...(data.ort              && { ort:              data.ort }),
      ...(data.raum             && { raum:             data.raum }),
      ...(data.personenzahl     && { personenzahl:     String(data.personenzahl) }),
      ...(data.konto            && { konto:            data.konto }),
      ...(data.kostenstelle     && { kostenstelle:     data.kostenstelle }),
      ...(data.kostentraeger    && { kostentraeger:    data.kostentraeger }),
      ...(data.wuensche                    && { wuensche:                    data.wuensche }),
      ...(data.rechnungsanschriftFirma      && { rechnungsanschriftFirma:      data.rechnungsanschriftFirma }),
      ...(data.rechnungsanschriftZuHaenden && { rechnungsanschriftZuHaenden: data.rechnungsanschriftZuHaenden }),
      ...(data.rechnungsanschriftStrasse   && { rechnungsanschriftStrasse:   data.rechnungsanschriftStrasse }),
      ...(data.rechnungsanschriftPlzOrt    && { rechnungsanschriftPlzOrt:    data.rechnungsanschriftPlzOrt }),
      ...(data.rechnungsanschriftAnlass    && { rechnungsanschriftAnlass:    data.rechnungsanschriftAnlass }),
      ...(data.rechnungsanschriftTeilnehmer && { rechnungsanschriftTeilnehmer: data.rechnungsanschriftTeilnehmer }),
      ...(data.rechnungsanschriftTelefon   && { rechnungsanschriftTelefon:   data.rechnungsanschriftTelefon }),
      ...(extractedPositionen.length > 0 && { positionen: extractedPositionen }),
    }));
  }

  async function handleSave() {
    if (!selectedObjektId) return alert('Bitte ein Objekt auswählen.');
    if (!f.besteller.trim()) return alert('Besteller/Auftraggeber fehlt.');
    if (!f.veranstaltung.trim()) return alert('Veranstaltung/Anlass fehlt.');
    if (!belegOk) {
      return alert('Bitte einen Bewirtungsbeleg hochladen – oder alle Bestelldaten ausfüllen und mindestens eine Position hinzufügen.');
    }
    const gewaehltes = objekte.find(o => o.id === selectedObjektId) ?? aktivesObjekt;
    setSaving(true);

    // Kein Original-Beleg hochgeladen, aber alle Bestelldaten + Positionen manuell
    // erfasst → Ersatz-Bewirtungsbeleg als PDF erzeugen und als Dokument ablegen.
    let fotoDataUrls = f.fotoDataUrls;
    if (!hatDokument && manuellVollstaendig) {
      const ersatzPdf = generateErsatzBelegPdf({
        objektName: gewaehltes?.name ?? '',
        besteller: f.besteller, veranstaltung: f.veranstaltung,
        cateringDatumVon: f.cateringDatumVon, cateringDatumBis: f.cateringDatumBis,
        uhrzeitVon: f.uhrzeitVon, uhrzeitBis: f.uhrzeitBis,
        ort: f.ort, raum: f.raum, personenzahl: parseInt(f.personenzahl) || 0,
        konto: f.konto, kostenstelle: f.kostenstelle, kostentraeger: f.kostentraeger,
        wuensche: f.wuensche,
        rechnungsanschriftFirma: f.rechnungsanschriftFirma,
        rechnungsanschriftZuHaenden: f.rechnungsanschriftZuHaenden,
        rechnungsanschriftStrasse: f.rechnungsanschriftStrasse,
        rechnungsanschriftPlzOrt: f.rechnungsanschriftPlzOrt,
        rechnungsanschriftAnlass: f.rechnungsanschriftAnlass,
        rechnungsanschriftTeilnehmer: f.rechnungsanschriftTeilnehmer,
        rechnungsanschriftTelefon: f.rechnungsanschriftTelefon,
        positionen: f.positionen,
        showPreise: showRechnung,
      });
      fotoDataUrls = [ersatzPdf];
    }

    if (editBeleg) {
      updateBeleg(editBeleg.id, {
        objektId: gewaehltes?.id ?? '', objektName: gewaehltes?.name ?? '',
        besteller: f.besteller, cateringDatumVon: f.cateringDatumVon, cateringDatumBis: f.cateringDatumBis,
        uhrzeitVon: f.uhrzeitVon, uhrzeitBis: f.uhrzeitBis, veranstaltung: f.veranstaltung,
        ort: f.ort, raum: f.raum, personenzahl: parseInt(f.personenzahl) || 0,
        konto: f.konto, kostenstelle: f.kostenstelle, kostentraeger: f.kostentraeger,
        positionen: f.positionen, fotoDataUrls,
        wuensche: f.wuensche, interneNotiz: f.interneNotiz,
        rechnungsanschriftFirma: f.rechnungsanschriftFirma,
        rechnungsanschriftZuHaenden: f.rechnungsanschriftZuHaenden,
        rechnungsanschriftStrasse: f.rechnungsanschriftStrasse,
        rechnungsanschriftPlzOrt: f.rechnungsanschriftPlzOrt,
        rechnungsanschriftAnlass: f.rechnungsanschriftAnlass,
        rechnungsanschriftTeilnehmer: f.rechnungsanschriftTeilnehmer,
        rechnungsanschriftTelefon: f.rechnungsanschriftTelefon,
      });
      setSaving(false);
      onClose();
      return;
    }

    addBeleg({
      objektId:   gewaehltes?.id   ?? '',
      objektName: gewaehltes?.name ?? '',
      besteller: f.besteller,
      cateringDatumVon: f.cateringDatumVon,
      cateringDatumBis: f.cateringDatumBis,
      uhrzeitVon: f.uhrzeitVon,
      uhrzeitBis: f.uhrzeitBis,
      veranstaltung: f.veranstaltung,
      ort: f.ort,
      raum: f.raum,
      personenzahl: parseInt(f.personenzahl) || 0,
      konto: f.konto,
      kostenstelle: f.kostenstelle,
      kostentraeger: f.kostentraeger,
      positionen: f.positionen,
      fotoDataUrls,
      wuensche: f.wuensche,
      interneNotiz: f.interneNotiz,
      rechnungsanschriftFirma: f.rechnungsanschriftFirma,
      rechnungsanschriftZuHaenden: f.rechnungsanschriftZuHaenden,
      rechnungsanschriftStrasse: f.rechnungsanschriftStrasse,
      rechnungsanschriftPlzOrt: f.rechnungsanschriftPlzOrt,
      rechnungsanschriftAnlass: f.rechnungsanschriftAnlass,
      rechnungsanschriftTeilnehmer: f.rechnungsanschriftTeilnehmer,
      rechnungsanschriftTelefon: f.rechnungsanschriftTelefon,
    }, currentUser?.name ?? currentUser?.email);

    setSaving(false);
    onClose();
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.closeBtn} onClick={onClose} type="button">✕</button>
        <BrandLogo className={s.headerLogo} />
        <button className={s.saveHdrBtn} onClick={handleSave} disabled={saving} type="button">
          {saving ? '…' : editBeleg ? 'Speichern' : 'Speichern'}
        </button>
      </div>

      <div className={s.scroll}>
        {/* ── FOTOS (prominent oben) ── */}
        <div className={s.section}>
          <PhotoCapture
            dataUrls={f.fotoDataUrls}
            onChange={v => set('fotoDataUrls', v)}
            onExtracted={applyExtracted}
          />
          {!hatDokument && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.45,
              border: `1px solid ${manuellVollstaendig ? '#a9dfbf' : '#f5d6a8'}`,
              background: manuellVollstaendig ? '#eafaf1' : '#fff8ec',
              color: manuellVollstaendig ? '#1a5c30' : '#8a5a00',
            }}>
              {manuellVollstaendig
                ? '✓ Kein Upload nötig – alle Bestelldaten sind ausgefüllt und Positionen vorhanden.'
                : <>📎 <strong>Bewirtungsbeleg hochladen</strong> – oder alle Bestelldaten ausfüllen und mindestens eine Position hinzufügen.
                    <br />Noch offen: {fehlendManuell.join(', ')}.</>}
            </div>
          )}
        </div>

        {/* ── OBJEKT-AUSWAHL ── */}
        {objekte.length > 1 && (
          <div className={s.section}>
            <div className={s.sectionTitle}>Objekt *</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {objekte.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedObjektId(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid ${o.id === selectedObjektId ? 'var(--ek-red)' : 'var(--ek-border)'}`,
                    background: o.id === selectedObjektId ? '#fdf5f5' : 'var(--ek-surface2)',
                    textAlign: 'left', width: '100%', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#fff',
                    background: o.id === selectedObjektId ? 'var(--ek-red)' : 'var(--ek-muted)',
                    borderRadius: 8, padding: '2px 7px', flexShrink: 0,
                  }}>{o.kuerzel ?? '🏢'}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-charcoal)', flex: 1 }}>{o.name}</span>
                  {o.id === selectedObjektId && <span style={{ color: 'var(--ek-red)', fontWeight: 900 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── KOPFDATEN ── */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Bestellerdaten</div>

          <Field label="Besteller / Auftraggeber *">
            <input value={f.besteller} onChange={e => set('besteller', e.target.value)} placeholder="Name des Bestellers" />
          </Field>
          <Field label="Veranstaltung / Anlass *">
            <input value={f.veranstaltung} onChange={e => set('veranstaltung', e.target.value)} placeholder="z.B. Vorstandssitzung, Schulung …" />
          </Field>
          <div className={s.twoCol}>
            <Field label="Datum von">
              <input type="date" value={f.cateringDatumVon} onChange={e => {
                const val = e.target.value;
                setF(prev => ({
                  ...prev,
                  cateringDatumVon: val,
                  cateringDatumBis: prev.cateringDatumBis === prev.cateringDatumVon || prev.cateringDatumBis < val ? val : prev.cateringDatumBis,
                }));
              }} />
            </Field>
            <Field label="Datum bis">
              <input type="date" value={f.cateringDatumBis} min={f.cateringDatumVon} onChange={e => set('cateringDatumBis', e.target.value)} />
            </Field>
          </div>
          <div className={s.twoCol}>
            <Field label="Uhrzeit von">
              <input type="time" value={f.uhrzeitVon} onChange={e => {
                const val = e.target.value;
                setF(prev => ({
                  ...prev,
                  uhrzeitVon: val,
                  uhrzeitBis: prev.cateringDatumVon === prev.cateringDatumBis && prev.uhrzeitBis && prev.uhrzeitBis < val
                    ? val : prev.uhrzeitBis,
                }));
              }} />
            </Field>
            <Field label="Uhrzeit bis">
              <input type="time" value={f.uhrzeitBis}
                onChange={e => {
                  const val = e.target.value;
                  const sameDay = f.cateringDatumVon === f.cateringDatumBis;
                  set('uhrzeitBis', sameDay && f.uhrzeitVon && val < f.uhrzeitVon ? f.uhrzeitVon : val);
                }} />
            </Field>
          </div>
          <div className={s.twoCol}>
            <Field label="Ort">
              <input value={f.ort} onChange={e => set('ort', e.target.value)} placeholder="Standort" />
            </Field>
            <Field label="Raum">
              <input value={f.raum} onChange={e => set('raum', e.target.value)} placeholder="Raum / Bereich" />
            </Field>
          </div>
          <Field label="Personenzahl">
            <input type="number" min="0" value={f.personenzahl} onChange={e => set('personenzahl', e.target.value)} placeholder="0" />
          </Field>
        </div>

        {/* ── RECHNUNGSANSCHRIFT ── */}
        {showRechnung && <div className={s.section}>
          <div className={s.sectionTitle}>Rechnungsanschrift</div>
          <Field label="Firma">
            <input value={f.rechnungsanschriftFirma} onChange={e => set('rechnungsanschriftFirma', e.target.value)} placeholder="Firmenbezeichnung" />
          </Field>
          <Field label="Zu Händen">
            <input value={f.rechnungsanschriftZuHaenden} onChange={e => set('rechnungsanschriftZuHaenden', e.target.value)} placeholder="Ansprechpartner" />
          </Field>
          <Field label="Straße / Hausnummer">
            <input value={f.rechnungsanschriftStrasse} onChange={e => set('rechnungsanschriftStrasse', e.target.value)} placeholder="Musterstraße 1" />
          </Field>
          <Field label="PLZ / Ort">
            <input value={f.rechnungsanschriftPlzOrt} onChange={e => set('rechnungsanschriftPlzOrt', e.target.value)} placeholder="30159 Hannover" />
          </Field>
          <Field label="Anlass">
            <input value={f.rechnungsanschriftAnlass} onChange={e => set('rechnungsanschriftAnlass', e.target.value)} placeholder="Anlass der Bewirtung" />
          </Field>
          <div className={s.twoCol}>
            <Field label="Teilnehmer">
              <input value={f.rechnungsanschriftTeilnehmer} onChange={e => set('rechnungsanschriftTeilnehmer', e.target.value)} placeholder="Namen der Teilnehmer" />
            </Field>
            <Field label="Telefon für Rückfragen">
              <input value={f.rechnungsanschriftTelefon} onChange={e => set('rechnungsanschriftTelefon', e.target.value)} placeholder="0511 …" />
            </Field>
          </div>
        </div>}

        {/* ── KOSTENZUORDNUNG ── */}
        {showRechnung && <div className={s.section}>
          <div className={s.sectionTitle}>Kostenzuordnung</div>
          <Field label="Konto">
            <input value={f.konto} onChange={e => set('konto', e.target.value)} placeholder="Kundennummer / Konto" />
          </Field>
          <div className={s.twoCol}>
            <Field label="Kostenstelle">
              <input value={f.kostenstelle} onChange={e => set('kostenstelle', e.target.value)} placeholder="KST" />
            </Field>
            <Field label="Kostenträger">
              <input value={f.kostentraeger} onChange={e => set('kostentraeger', e.target.value)} placeholder="KTR" />
            </Field>
          </div>
        </div>}

        {/* ── POSITIONEN ── */}
        <div className={s.section}>
          <PositionEditor positionen={f.positionen} onChange={v => set('positionen', v)} />
        </div>

        {/* ── WÜNSCHE & NOTIZEN ── */}
        <div className={s.section}>
          <div className={s.sectionTitle}>Wünsche & Notizen</div>
          <Field label="Wünsche / Sonstige Informationen">
            <textarea value={f.wuensche} onChange={e => set('wuensche', e.target.value)}
              placeholder="Allergien, Sonderwünsche …" rows={3} />
          </Field>
          <Field label="Interne Notiz">
            <textarea value={f.interneNotiz} onChange={e => set('interneNotiz', e.target.value)}
              placeholder="Nur intern sichtbar …" rows={3} />
          </Field>
        </div>

        {/* Bottom save button */}
        <button className={s.saveBtn} onClick={handleSave} disabled={saving} type="button">
          {saving ? '⏳ Wird gespeichert …' : '✓ Beleg speichern'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

import { useState } from 'react';
import { useSalesStore } from '../../store/salesStore';
import { useAuthStore } from '../../store/authStore';
import { useObjektStore, useSichtbareObjekte } from '../../store/objektStore';
import { SALES_SEGMENTE, SALES_QUELLEN } from '../../types';
import type { SalesSegment, SalesQuelle } from '../../types';
import s from './SalesNewAnfrageScreen.module.css';

interface Props { onClose: () => void; onCreated: (id: string) => void; }

export function SalesNewAnfrageScreen({ onClose, onCreated }: Props) {
  const addAnfrage = useSalesStore(st => st.addAnfrage);
  const userName   = useAuthStore(st => st.user?.name);
  // Mandant/Objekt der Anfrage — bestimmt die Sichtbarkeit (Objekt-Scoping).
  const objekte    = useSichtbareObjekte();
  const aktivesObjekt = useObjektStore(st => st.getAktivesObjekt()) ?? objekte[0] ?? null;
  const [objektId, setObjektId] = useState<string>(aktivesObjekt?.id ?? '');

  const [segment, setSegment]         = useState<SalesSegment>('catering');
  const [quelle, setQuelle]           = useState<SalesQuelle>('website');
  const [kundeFirma, setKundeFirma]   = useState('');
  const [ansprechpartner, setAnsprech] = useState('');
  const [email, setEmail]             = useState('');
  const [telefon, setTelefon]         = useState('');
  const [veranstaltung, setVeranst]   = useState('');
  const [datum, setDatum]             = useState('');
  const [personenzahl, setPersonen]   = useState('');
  const [ort, setOrt]                 = useState('');
  const [wert, setWert]               = useState('');
  const [wiedervorlage, setWv]        = useState('');
  const [notiz, setNotiz]             = useState('');

  const canSave = kundeFirma.trim() && veranstaltung.trim() && objektId;

  function save() {
    if (!canSave) return;
    const id = addAnfrage({
      objektId,
      segment,
      quelle,
      kundeFirma: kundeFirma.trim(),
      ansprechpartner: ansprechpartner.trim(),
      email: email.trim(),
      telefon: telefon.trim(),
      veranstaltung: veranstaltung.trim(),
      datum: datum || undefined,
      personenzahl: Number(personenzahl) || 0,
      ort: ort.trim(),
      geschaetzterWert: Number(wert) || 0,
      wiederkehrend: segment === 'betriebsgastronomie',
      verantwortlich: userName ?? 'Vertrieb',
      wiedervorlage: wiedervorlage || undefined,
      notiz: notiz.trim(),
    });
    onCreated(id);
  }

  return (
    <div className={s.screen}>
      <div className={s.header}>
        <button className={s.back} onClick={onClose} type="button">‹</button>
        <span className={s.headerTitle}>Neue Anfrage</span>
      </div>

      <div className={s.scroll}>
        {objekte.length > 1 && (
          <>
            <Label>Objekt *</Label>
            <select className={s.input} value={objektId} onChange={e => setObjektId(e.target.value)}>
              {objekte.map(o => <option key={o.id} value={o.id}>{o.kuerzel ? `${o.kuerzel} – ` : ''}{o.name}</option>)}
            </select>
          </>
        )}

        <Label>Segment</Label>
        <div className={s.segRow}>
          {SALES_SEGMENTE.map(seg => (
            <button key={seg.value} type="button"
              className={`${s.segBtn} ${segment === seg.value ? s.segActive : ''}`}
              onClick={() => setSegment(seg.value)}>
              {seg.label}
            </button>
          ))}
        </div>

        <Label>Kunde / Firma *</Label>
        <input className={s.input} value={kundeFirma} onChange={e => setKundeFirma(e.target.value)} placeholder="z.B. TechNova GmbH" />

        <Label>Ansprechpartner</Label>
        <input className={s.input} value={ansprechpartner} onChange={e => setAnsprech(e.target.value)} placeholder="Name" />

        <div className={s.twoCol}>
          <div>
            <Label>E-Mail</Label>
            <input className={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kontakt@…" />
          </div>
          <div>
            <Label>Telefon</Label>
            <input className={s.input} value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="0511 …" />
          </div>
        </div>

        <Label>Veranstaltung / Bedarf *</Label>
        <input className={s.input} value={veranstaltung} onChange={e => setVeranst(e.target.value)} placeholder="z.B. Sommerfest 2026 / Kantinen-Vollverpflegung" />

        <div className={s.twoCol}>
          <div>
            <Label>Datum / Start</Label>
            <input className={s.input} type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </div>
          <div>
            <Label>Personen</Label>
            <input className={s.input} type="number" inputMode="numeric" value={personenzahl} onChange={e => setPersonen(e.target.value)} placeholder="0" />
          </div>
        </div>

        <Label>Ort</Label>
        <input className={s.input} value={ort} onChange={e => setOrt(e.target.value)} placeholder="Veranstaltungsort" />

        <div className={s.twoCol}>
          <div>
            <Label>{segment === 'betriebsgastronomie' ? 'Wert € / Jahr' : 'Auftragswert €'}</Label>
            <input className={s.input} type="number" inputMode="numeric" value={wert} onChange={e => setWert(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Wiedervorlage</Label>
            <input className={s.input} type="date" value={wiedervorlage} onChange={e => setWv(e.target.value)} />
          </div>
        </div>

        <Label>Quelle</Label>
        <select className={s.input} value={quelle} onChange={e => setQuelle(e.target.value as SalesQuelle)}>
          {SALES_QUELLEN.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>

        <Label>Notiz</Label>
        <textarea className={s.textarea} value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} placeholder="Details zum Bedarf…" />

        <button type="button" className={s.save} disabled={!canSave} onClick={save}>
          Anfrage anlegen
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className={s.label}>{children}</label>;
}

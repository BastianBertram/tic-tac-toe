import { useState } from 'react';
import { EINHEITEN, KATEGORIEN } from '../types';
import type { Produkt } from '../types';
import { useProduktStore } from '../store/produktStore';
import { euroFull } from './sales/salesUtils';
import s from './sales/AngeboteScreen.module.css';

/**
 * Produktkatalog-Verwaltung (Admin). Pflegt die Artikel/Leistungen, die im
 * Angebots-Editor per „Aus Produktkatalog hinzufügen" auswählbar sind.
 * Server-Collection `produkte` ist admin-write + id-erhaltend (Soft-Delete).
 */
export function ProdukteScreen() {
  const produkte      = useProduktStore(st => st.produkte);
  const addProdukt    = useProduktStore(st => st.addProdukt);
  const updateProdukt = useProduktStore(st => st.updateProdukt);
  const deleteProdukt = useProduktStore(st => st.deleteProdukt);

  const sichtbar = produkte
    .filter(p => !p.deleted)
    .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, 'de'));

  const [editId, setEditId]   = useState<string | null>(null);
  const [showForm, setShow]   = useState(false);
  const [bezeichnung, setBez] = useState('');
  const [kategorie, setKat]   = useState<string>(KATEGORIEN[0]);
  const [einheit, setEinheit] = useState('Stk');
  const [basispreis, setPreis] = useState('');
  const [aktiv, setAktiv]     = useState(true);

  function neu() {
    setEditId(null); setBez(''); setKat(KATEGORIEN[0]); setEinheit('Stk'); setPreis(''); setAktiv(true); setShow(true);
  }
  function bearbeiten(p: Produkt) {
    setEditId(p.id); setBez(p.bezeichnung); setKat(p.kategorie); setEinheit(p.einheit); setPreis(String(p.basispreis)); setAktiv(p.aktiv); setShow(true);
  }
  function speichern() {
    const data = { bezeichnung: bezeichnung.trim(), kategorie: kategorie.trim() || 'Sonstiges', einheit, basispreis: Number(basispreis) || 0, aktiv };
    if (!data.bezeichnung) return;
    if (editId) updateProdukt(editId, data);
    else addProdukt(data);
    setShow(false); setEditId(null);
  }
  function loeschen() {
    if (editId && window.confirm('Produkt aus dem Katalog entfernen?')) {
      deleteProdukt(editId); setShow(false); setEditId(null);
    }
  }

  const canSave = bezeichnung.trim().length > 0;

  return (
    <div className={s.scroll}>
      {!showForm && (
        <button type="button" className={s.save} style={{ marginTop: 0 }} onClick={neu}>+ Neues Produkt</button>
      )}

      {showForm && (
        <div className={s.infoCard} style={{ padding: 14, marginBottom: 16 }}>
          <label className={s.label}>Bezeichnung *</label>
          <input className={s.input} value={bezeichnung} onChange={e => setBez(e.target.value)} placeholder="z.B. Belegte Brötchen" />
          <label className={s.label}>Kategorie</label>
          <input className={s.input} list="kat-liste" value={kategorie} onChange={e => setKat(e.target.value)} />
          <datalist id="kat-liste">{KATEGORIEN.map(k => <option key={k} value={k} />)}</datalist>
          <div className={s.twoCol}>
            <div>
              <label className={s.label}>Einheit</label>
              <select className={s.input} value={einheit} onChange={e => setEinheit(e.target.value)}>
                {EINHEITEN.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={s.label}>Basispreis €</label>
              <input className={s.input} type="number" inputMode="decimal" value={basispreis} onChange={e => setPreis(e.target.value)} placeholder="0" />
            </div>
          </div>
          <label className={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none' }}>
            <input type="checkbox" checked={aktiv} onChange={e => setAktiv(e.target.checked)} /> Aktiv (im Angebots-Editor wählbar)
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className={s.btnSecondary} onClick={() => { setShow(false); setEditId(null); }}>Abbrechen</button>
            {editId && <button type="button" className={s.btnReject} onClick={loeschen}>🗑 Löschen</button>}
            <button type="button" className={s.btnPrimary} disabled={!canSave} onClick={speichern}>Speichern</button>
          </div>
        </div>
      )}

      <div className={s.sectionLabel}>Katalog ({sichtbar.length})</div>
      {sichtbar.length === 0 && <p className={s.leer}>Noch keine Produkte. Mit „+ Neues Produkt" anlegen.</p>}
      <div className={s.infoCard}>
        {sichtbar.map(p => (
          <button key={p.id} type="button" className={s.posLine} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--ek-border)', cursor: 'pointer', textAlign: 'left' }} onClick={() => bearbeiten(p)}>
            <div>
              <div className={s.posLineName} style={{ opacity: p.aktiv ? 1 : 0.5 }}>
                {p.bezeichnung}{!p.aktiv && ' (inaktiv)'}
              </div>
              <div className={s.posLineSub}>{p.kategorie} · {p.einheit}</div>
            </div>
            <div className={s.posLineSum}>{euroFull(p.basispreis)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

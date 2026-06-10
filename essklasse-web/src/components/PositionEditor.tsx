import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { KATEGORIEN, EINHEITEN } from '../types';
import type { BelegPosition, Kategorie } from '../types';
import { useAuthStore } from '../store/authStore';
import s from './PositionEditor.module.css';

interface Props { positionen: BelegPosition[]; onChange: (p: BelegPosition[]) => void; }

const EMPTY: Omit<BelegPosition, 'id'> = {
  kategorie: 'Heißgetränke', bezeichnung: '', einheit: 'Stk', preis: 0, menge: 1,
};

export function PositionEditor({ positionen, onChange }: Props) {
  const rolle = useAuthStore(st => st.user?.rolle);
  const showPreise = rolle === 'buchhaltung' || rolle === 'admin' || rolle === 'geschaeftsfuehrung';

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<BelegPosition, 'id'>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  function openNew() { setDraft(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(p: BelegPosition) { setDraft({ ...p }); setEditId(p.id); setOpen(true); }

  function save() {
    if (!draft.bezeichnung.trim()) return alert('Bezeichnung fehlt.');
    if (editId) {
      onChange(positionen.map(p => p.id === editId ? { ...draft, id: editId } : p));
    } else {
      onChange([...positionen, { ...draft, id: uuidv4() }]);
    }
    setOpen(false);
  }

  function remove(id: string) {
    if (confirm('Position löschen?')) onChange(positionen.filter(p => p.id !== id));
  }

  const total = positionen.reduce((acc, p) => acc + p.preis * p.menge, 0);

  return (
    <div>
      <div className={s.header}>
        <span className={s.sectionLabel}>Positionen / Leistungen</span>
        <button className={s.addBtn} type="button" onClick={openNew}>+ Hinzufügen</button>
      </div>

      <p className={s.hinweis}>⚠️ Bitte prüfen: Die KI-erkannten Positionen dienen nur als Hilfe. Maßgeblich ist immer der originale Bewirtungsschein — Positionen ggf. korrigieren, ergänzen oder löschen.</p>

      {positionen.length === 0 && <p className={s.empty}>Noch keine Positionen.</p>}

      {KATEGORIEN.filter(kat => positionen.some(p => p.kategorie === kat)).map(kat => (
        <div key={kat} className={s.gruppe}>
          <div className={s.gruppeHeader}>{kat}</div>
          {positionen.filter(p => p.kategorie === kat).map(p => (
            <div key={p.id} className={s.row} onClick={() => openEdit(p)}>
              <div className={s.rowInfo}>
                <div className={s.rowName}>{p.bezeichnung}</div>
                {showPreise && <div className={s.rowMeta}>{p.einheit} · {p.preis.toFixed(2)} €</div>}
              </div>
              {showPreise
                ? <div className={s.rowTotal}>{(p.preis * p.menge).toFixed(2)} €</div>
                : <div className={s.rowMenge}>{p.menge} Stk</div>
              }
            </div>
          ))}
        </div>
      ))}

      {positionen.length > 0 && showPreise && (
        <div className={s.totalRow}>
          <span>Gesamt</span>
          <span className={s.totalVal}>{total.toFixed(2)} €</span>
        </div>
      )}

      {/* Inline modal */}
      {open && (
        <div className={s.overlay} onClick={() => setOpen(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <span>{editId ? 'Bearbeiten' : 'Neue Position'}</span>
              <button onClick={() => setOpen(false)} type="button" className={s.closeBtn}>✕</button>
            </div>

            <label className={s.fieldLabel}>Kategorie</label>
            <select value={draft.kategorie} onChange={e => setDraft({ ...draft, kategorie: e.target.value as Kategorie })}>
              {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
            </select>

            <label className={s.fieldLabel}>Bezeichnung *</label>
            <input value={draft.bezeichnung} onChange={e => setDraft({ ...draft, bezeichnung: e.target.value })}
              placeholder="Produktbezeichnung" autoFocus />

            <label className={s.fieldLabel}>Einheit</label>
            <select value={draft.einheit} onChange={e => setDraft({ ...draft, einheit: e.target.value })}>
              {EINHEITEN.map(e => <option key={e}>{e}</option>)}
            </select>

            <div className={s.twoCol}>
              {showPreise && (
                <div>
                  <label className={s.fieldLabel}>Preis (€)</label>
                  <input type="number" min="0" step="0.01" value={draft.preis}
                    onChange={e => setDraft({ ...draft, preis: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              <div>
                <label className={s.fieldLabel}>Menge</label>
                <input type="number" min="0" step="1" value={draft.menge}
                  onChange={e => setDraft({ ...draft, menge: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {showPreise && (
              <div className={s.lineTotal}>
                Zeilensumme: <strong style={{ color: 'var(--light)' }}>{(draft.preis * draft.menge).toFixed(2)} €</strong>
              </div>
            )}

            <button className={s.saveBtn} type="button" onClick={save}>Speichern</button>
            {editId && (
              <button className={s.deleteBtn} type="button" onClick={() => { remove(editId); setOpen(false); }}>
                🗑 Position löschen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

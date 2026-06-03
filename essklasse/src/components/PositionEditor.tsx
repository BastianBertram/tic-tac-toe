import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BelegPosition, Kategorie, KATEGORIEN, EINHEITEN } from '../types';
import uuid from 'react-native-uuid';

interface Props {
  positionen: BelegPosition[];
  onChange: (positionen: BelegPosition[]) => void;
}

const EMPTY: Omit<BelegPosition, 'id'> = {
  kategorie: 'Heißgetränke',
  bezeichnung: '',
  einheit: 'Stk',
  preis: 0,
  menge: 1,
};

export function PositionEditor({ positionen, onChange }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<Omit<BelegPosition, 'id'>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [showKatPicker, setShowKatPicker] = useState(false);
  const [showEinheitPicker, setShowEinheitPicker] = useState(false);

  function openNew() {
    setDraft(EMPTY);
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(pos: BelegPosition) {
    setDraft({ ...pos });
    setEditId(pos.id);
    setShowModal(true);
  }

  function save() {
    if (!draft.bezeichnung.trim()) {
      Alert.alert('Bezeichnung fehlt', 'Bitte eine Produktbezeichnung eingeben.');
      return;
    }
    if (editId) {
      onChange(positionen.map((p) => (p.id === editId ? { ...draft, id: editId } : p)));
    } else {
      onChange([...positionen, { ...draft, id: uuid.v4() as string }]);
    }
    setShowModal(false);
  }

  function remove(id: string) {
    Alert.alert('Position löschen?', '', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => onChange(positionen.filter((p) => p.id !== id)) },
    ]);
  }

  const total = positionen.reduce((s, p) => s + p.preis * p.menge, 0);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.label}>Positionen / Leistungen</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {positionen.length === 0 && (
        <Text style={styles.empty}>Noch keine Positionen hinzugefügt.</Text>
      )}

      {positionen.map((pos) => (
        <TouchableOpacity key={pos.id} onPress={() => openEdit(pos)} style={styles.posRow} activeOpacity={0.8}>
          <View style={styles.katBadge}>
            <Text style={styles.katText}>{pos.kategorie.substring(0, 3)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.posName}>{pos.bezeichnung}</Text>
            <Text style={styles.posMeta}>{pos.menge} {pos.einheit} · {pos.preis.toFixed(2)} €/Stk</Text>
          </View>
          <Text style={styles.posTotal}>{(pos.preis * pos.menge).toFixed(2)} €</Text>
          <TouchableOpacity onPress={() => remove(pos.id)} style={{ marginLeft: 8 }}>
            <Ionicons name="trash-outline" size={18} color="#e94560" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {positionen.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Gesamt</Text>
          <Text style={styles.totalValue}>{total.toFixed(2)} €</Text>
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={26} color="#b0b3b8" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editId ? 'Position bearbeiten' : 'Neue Position'}</Text>
            <TouchableOpacity onPress={save} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Speichern</Text>
            </TouchableOpacity>
          </View>

          {/* Kategorie */}
          <Text style={styles.fieldLabel}>Kategorie</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowKatPicker(true)}>
            <Text style={styles.pickerText}>{draft.kategorie}</Text>
            <Ionicons name="chevron-down" size={18} color="#b0b3b8" />
          </TouchableOpacity>

          {/* Bezeichnung */}
          <Text style={styles.fieldLabel}>Produktbezeichnung *</Text>
          <TextInput
            style={styles.input}
            value={draft.bezeichnung}
            onChangeText={(v) => setDraft({ ...draft, bezeichnung: v })}
            placeholder="z.B. Filterkaffee, Sandwiches …"
            placeholderTextColor="#555"
          />

          {/* Einheit */}
          <Text style={styles.fieldLabel}>Einheit</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowEinheitPicker(true)}>
            <Text style={styles.pickerText}>{draft.einheit}</Text>
            <Ionicons name="chevron-down" size={18} color="#b0b3b8" />
          </TouchableOpacity>

          {/* Preis & Menge */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Preis (€)</Text>
              <TextInput
                style={styles.input}
                value={String(draft.preis)}
                onChangeText={(v) => setDraft({ ...draft, preis: parseFloat(v) || 0 })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#555"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Menge</Text>
              <TextInput
                style={styles.input}
                value={String(draft.menge)}
                onChangeText={(v) => setDraft({ ...draft, menge: parseInt(v) || 0 })}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor="#555"
              />
            </View>
          </View>

          <View style={styles.lineTotal}>
            <Text style={styles.lineTotalLabel}>Zeilensumme:</Text>
            <Text style={styles.lineTotalValue}>{(draft.preis * draft.menge).toFixed(2)} €</Text>
          </View>
        </View>

        {/* Kategorie picker sheet */}
        <Modal visible={showKatPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.overlay} onPress={() => setShowKatPicker(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Kategorie wählen</Text>
            {KATEGORIEN.map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.sheetItem, draft.kategorie === k && styles.sheetItemActive]}
                onPress={() => { setDraft({ ...draft, kategorie: k }); setShowKatPicker(false); }}
              >
                <Text style={[styles.sheetItemText, draft.kategorie === k && { color: '#a8dadc', fontWeight: '700' }]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>

        {/* Einheit picker sheet */}
        <Modal visible={showEinheitPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.overlay} onPress={() => setShowEinheitPicker(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Einheit wählen</Text>
            {EINHEITEN.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.sheetItem, draft.einheit === e && styles.sheetItemActive]}
                onPress={() => { setDraft({ ...draft, einheit: e }); setShowEinheitPicker(false); }}
              >
                <Text style={[styles.sheetItemText, draft.einheit === e && { color: '#a8dadc', fontWeight: '700' }]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { color: '#b0b3b8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1877f2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: '#555', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },

  posRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, padding: 12, marginBottom: 8 },
  katBadge: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#0f3460', alignItems: 'center', justifyContent: 'center' },
  katText: { color: '#a8dadc', fontSize: 11, fontWeight: '700' },
  posName: { color: '#e4e6ea', fontSize: 14, fontWeight: '600' },
  posMeta: { color: '#b0b3b8', fontSize: 12, marginTop: 2 },
  posTotal: { color: '#a8dadc', fontSize: 14, fontWeight: '700' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#3a3b3c' },
  totalLabel: { color: '#b0b3b8', fontSize: 14, marginRight: 12 },
  totalValue: { color: '#a8dadc', fontSize: 18, fontWeight: '800' },

  // Modal
  modal: { flex: 1, backgroundColor: '#1a1a2e', padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { color: '#e4e6ea', fontSize: 17, fontWeight: '700' },
  saveBtn: { backgroundColor: '#1877f2', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  fieldLabel: { color: '#b0b3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: '#16213e', color: '#e4e6ea', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: '#3a3b3c' },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: '#3a3b3c' },
  pickerText: { color: '#e4e6ea', fontSize: 15 },
  row: { flexDirection: 'row' },

  lineTotal: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  lineTotalLabel: { color: '#b0b3b8', fontSize: 14, marginRight: 10 },
  lineTotalValue: { color: '#a8dadc', fontSize: 20, fontWeight: '800' },

  // Sheet / picker overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#16213e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { color: '#e4e6ea', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3a3b3c' },
  sheetItemActive: { backgroundColor: '#0f3460', borderRadius: 8, paddingHorizontal: 10 },
  sheetItemText: { color: '#e4e6ea', fontSize: 15 },
});

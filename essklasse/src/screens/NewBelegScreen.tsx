import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useBelegStore } from '../store/belegStore';
import { PhotoCapture } from '../components/PhotoCapture';
import { PositionEditor } from '../components/PositionEditor';
import { createSalesOrder } from '../services/bcService';
import { BelegPosition } from '../types';

interface Props {
  onClose: () => void;
  onSuccess?: (belegId: string) => void;
}

interface FormState {
  besteller: string;
  cateringDatumVon: string;
  cateringDatumBis: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  veranstaltung: string;
  ort: string;
  raum: string;
  personenzahl: string;
  konto: string;
  kostenstelle: string;
  kostentraeger: string;
  positionen: BelegPosition[];
  fotoUris: string[];
  wuensche: string;
  interneNotiz: string;
}

const today = format(new Date(), 'yyyy-MM-dd');

const INITIAL: FormState = {
  besteller: '',
  cateringDatumVon: today,
  cateringDatumBis: today,
  uhrzeitVon: '',
  uhrzeitBis: '',
  veranstaltung: '',
  ort: '',
  raum: '',
  personenzahl: '',
  konto: '',
  kostenstelle: '',
  kostentraeger: '',
  positionen: [],
  fotoUris: [],
  wuensche: '',
  interneNotiz: '',
};

export function NewBelegScreen({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [savedOrderNr, setSavedOrderNr] = useState<string | null>(null);

  const addBeleg = useBelegStore((s) => s.addBeleg);
  const setBcAuftragsnummer = useBelegStore((s) => s.setBcAuftragsnummer);
  const setSyncStatus = useBelegStore((s) => s.setSyncStatus);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.besteller.trim()) {
      Alert.alert('Pflichtfeld', 'Bitte den Besteller/Auftraggeber eingeben.');
      return;
    }
    if (!form.veranstaltung.trim()) {
      Alert.alert('Pflichtfeld', 'Bitte die Veranstaltung / den Anlass eingeben.');
      return;
    }

    setSaving(true);
    const belegId = addBeleg({
      besteller: form.besteller,
      cateringDatumVon: form.cateringDatumVon,
      cateringDatumBis: form.cateringDatumBis,
      uhrzeitVon: form.uhrzeitVon,
      uhrzeitBis: form.uhrzeitBis,
      veranstaltung: form.veranstaltung,
      ort: form.ort,
      raum: form.raum,
      personenzahl: parseInt(form.personenzahl) || 0,
      konto: form.konto,
      kostenstelle: form.kostenstelle,
      kostentraeger: form.kostentraeger,
      positionen: form.positionen,
      fotoUris: form.fotoUris,
      wuensche: form.wuensche,
      interneNotiz: form.interneNotiz,
    });

    // Try BC sync immediately
    try {
      const beleg = useBelegStore.getState().belege.find((b) => b.id === belegId)!;
      setSyncStatus(belegId, 'syncing');
      const result = await createSalesOrder(beleg);
      setBcAuftragsnummer(belegId, result.auftragsnummer);
      setSavedOrderNr(result.auftragsnummer);
    } catch (e: any) {
      setSyncStatus(belegId, 'error', e?.message ?? 'Fehler');
      // Beleg is saved locally — sync will retry later
    }

    setSaving(false);
    if (!savedOrderNr) {
      // Already saved locally; if BC failed, show success anyway
      Alert.alert(
        'Beleg gespeichert',
        savedOrderNr
          ? `BC-Auftrag: ${savedOrderNr}`
          : 'Lokal gespeichert. Die Übertragung an Business Central erfolgt sobald eine Verbindung verfügbar ist.',
        [{ text: 'OK', onPress: () => { onSuccess?.(belegId); onClose(); } }]
      );
    }
  }

  // Success overlay
  if (savedOrderNr) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={52} color="#b7e4c7" />
          </View>
          <Text style={styles.successTitle}>Beleg übertragen!</Text>
          <Text style={styles.successLabel}>BC-Auftragsnummer</Text>
          <Text style={styles.successOrderNr}>{savedOrderNr}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { onClose(); }}>
            <Text style={styles.doneBtnText}>Fertig</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => { setForm(INITIAL); setSavedOrderNr(null); }}>
            <Text style={styles.newBtnText}>Weiteren Beleg anlegen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#b0b3b8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neuer Bewirtungsbeleg</Text>
          <TouchableOpacity
            style={[styles.saveHdrBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveHdrText}>Speichern</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ═══ FOTO-BEREICH (prominent oben) ═══ */}
          <View style={styles.section}>
            <PhotoCapture
              uris={form.fotoUris}
              onChange={(uris) => set('fotoUris', uris)}
            />
          </View>

          {/* ═══ KOPFDATEN ═══ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kopfdaten</Text>

            <Field label="Besteller / Auftraggeber *">
              <TextInput
                style={styles.input}
                value={form.besteller}
                onChangeText={(v) => set('besteller', v)}
                placeholder="Name des Bestellers"
                placeholderTextColor="#555"
              />
            </Field>

            <Field label="Veranstaltung / Anlass *">
              <TextInput
                style={styles.input}
                value={form.veranstaltung}
                onChangeText={(v) => set('veranstaltung', v)}
                placeholder="z.B. Vorstandssitzung, Schulung, Empfang …"
                placeholderTextColor="#555"
              />
            </Field>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Field label="Catering-Datum von">
                  <TextInput
                    style={styles.input}
                    value={form.cateringDatumVon}
                    onChangeText={(v) => set('cateringDatumVon', v)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Field label="bis">
                  <TextInput
                    style={styles.input}
                    value={form.cateringDatumBis}
                    onChangeText={(v) => set('cateringDatumBis', v)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Field label="Uhrzeit von">
                  <TextInput
                    style={styles.input}
                    value={form.uhrzeitVon}
                    onChangeText={(v) => set('uhrzeitVon', v)}
                    placeholder="09:00"
                    placeholderTextColor="#555"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Field label="bis">
                  <TextInput
                    style={styles.input}
                    value={form.uhrzeitBis}
                    onChangeText={(v) => set('uhrzeitBis', v)}
                    placeholder="11:00"
                    placeholderTextColor="#555"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Field label="Ort">
                  <TextInput
                    style={styles.input}
                    value={form.ort}
                    onChangeText={(v) => set('ort', v)}
                    placeholder="Standort"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Field label="Raum">
                  <TextInput
                    style={styles.input}
                    value={form.raum}
                    onChangeText={(v) => set('raum', v)}
                    placeholder="Raum / Bereich"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
            </View>

            <Field label="Personenzahl / Teilnehmer">
              <TextInput
                style={styles.input}
                value={form.personenzahl}
                onChangeText={(v) => set('personenzahl', v)}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="number-pad"
              />
            </Field>
          </View>

          {/* ═══ KOSTENZUORDNUNG ═══ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kostenzuordnung</Text>

            <Field label="Konto">
              <TextInput
                style={styles.input}
                value={form.konto}
                onChangeText={(v) => set('konto', v)}
                placeholder="Kundennummer / Konto"
                placeholderTextColor="#555"
                keyboardType="number-pad"
              />
            </Field>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Field label="Kostenstelle">
                  <TextInput
                    style={styles.input}
                    value={form.kostenstelle}
                    onChangeText={(v) => set('kostenstelle', v)}
                    placeholder="KST"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Field label="Kostenträger">
                  <TextInput
                    style={styles.input}
                    value={form.kostentraeger}
                    onChangeText={(v) => set('kostentraeger', v)}
                    placeholder="KTR"
                    placeholderTextColor="#555"
                  />
                </Field>
              </View>
            </View>
          </View>

          {/* ═══ POSITIONEN ═══ */}
          <View style={styles.section}>
            <PositionEditor
              positionen={form.positionen}
              onChange={(p) => set('positionen', p)}
            />
          </View>

          {/* ═══ WÜNSCHE & NOTIZEN ═══ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wünsche & Notizen</Text>

            <Field label="Wünsche / Sonstige Informationen">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.wuensche}
                onChangeText={(v) => set('wuensche', v)}
                placeholder="Besondere Wünsche, Allergien, Sonderwünsche …"
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>

            <Field label="Interne Notiz">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.interneNotiz}
                onChangeText={(v) => set('interneNotiz', v)}
                placeholder="Nur intern sichtbar …"
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Field>
          </View>

          {/* Save button at bottom */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>Beleg speichern & übertragen</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3b3c',
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: '#e4e6ea', fontSize: 16, fontWeight: '700' },
  saveHdrBtn: { backgroundColor: '#1877f2', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveHdrText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 120 },

  section: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { color: '#a8dadc', fontSize: 14, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: { flexDirection: 'row' },
  fieldLabel: { color: '#b0b3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: '#0f3460',
    color: '#e4e6ea',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a3b3c',
  },
  textarea: { minHeight: 80 },

  saveBtn: {
    backgroundColor: '#e94560',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    shadowColor: '#e94560',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Success
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#1a1a2e' },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1a3a2a', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: '#e4e6ea', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  successLabel: { color: '#b0b3b8', fontSize: 14, marginBottom: 6 },
  successOrderNr: { color: '#a8dadc', fontSize: 32, fontWeight: '900', letterSpacing: 2, marginBottom: 40 },
  doneBtn: { backgroundColor: '#1877f2', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, marginBottom: 14, width: '100%', alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  newBtn: { paddingVertical: 14, width: '100%', alignItems: 'center' },
  newBtnText: { color: '#a8dadc', fontSize: 15, fontWeight: '600' },
});

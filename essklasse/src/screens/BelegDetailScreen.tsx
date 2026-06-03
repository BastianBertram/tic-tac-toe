import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bewirtungsbeleg } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useBelegStore } from '../store/belegStore';
import { createSalesOrder } from '../services/bcService';

const { width } = Dimensions.get('window');

interface Props {
  beleg: Bewirtungsbeleg;
  onClose: () => void;
}

export function BelegDetailScreen({ beleg: initialBeleg, onClose }: Props) {
  const store = useBelegStore();
  const beleg = store.belege.find((b) => b.id === initialBeleg.id) ?? initialBeleg;
  const [retrying, setRetrying] = React.useState(false);

  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
  const total = beleg.positionen.reduce((s, p) => s + p.preis * p.menge, 0);

  async function retrySync() {
    setRetrying(true);
    store.setSyncStatus(beleg.id, 'syncing');
    try {
      const result = await createSalesOrder(beleg);
      store.setBcAuftragsnummer(beleg.id, result.auftragsnummer);
      Alert.alert('Erfolg!', `BC-Auftragsnummer: ${result.auftragsnummer}`);
    } catch (e: any) {
      store.setSyncStatus(beleg.id, 'error', e?.message);
      Alert.alert('Fehler', e?.message ?? 'Übertragung fehlgeschlagen.');
    }
    setRetrying(false);
  }

  function confirmDelete() {
    Alert.alert('Beleg löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { store.deleteBeleg(beleg.id); onClose(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="arrow-back" size={22} color="#b0b3b8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{beleg.veranstaltung || 'Bewirtungsbeleg'}</Text>
        <TouchableOpacity onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={22} color="#e94560" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status & BC order */}
        <View style={styles.statusRow}>
          <StatusBadge status={beleg.syncStatus} />
          {beleg.bcAuftragsnummer && (
            <View style={styles.orderNrBox}>
              <Ionicons name="checkmark-circle" size={16} color="#b7e4c7" />
              <Text style={styles.orderNrText}>BC {beleg.bcAuftragsnummer}</Text>
            </View>
          )}
          {(beleg.syncStatus === 'local' || beleg.syncStatus === 'error') && (
            <TouchableOpacity style={styles.retryBtn} onPress={retrySync} disabled={retrying}>
              {retrying
                ? <ActivityIndicator size="small" color="#a8dadc" />
                : <><Ionicons name="cloud-upload-outline" size={15} color="#a8dadc" /><Text style={styles.retryText}>Erneut senden</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
        {beleg.bcFehler && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={15} color="#e94560" />
            <Text style={styles.errorText}>{beleg.bcFehler}</Text>
          </View>
        )}

        {/* Kopfdaten */}
        <Section title="Kopfdaten">
          <Row label="Besteller" value={beleg.besteller} />
          <Row label="Datum" value={`${datum}${beleg.cateringDatumBis !== beleg.cateringDatumVon ? ' – ' + format(parseISO(beleg.cateringDatumBis), 'dd.MM.yyyy', { locale: de }) : ''}`} />
          <Row label="Uhrzeit" value={`${beleg.uhrzeitVon} – ${beleg.uhrzeitBis}`} />
          <Row label="Veranstaltung" value={beleg.veranstaltung} />
          <Row label="Ort / Raum" value={[beleg.ort, beleg.raum].filter(Boolean).join(' / ')} />
          <Row label="Personen" value={String(beleg.personenzahl)} />
          <Row label="Konto" value={beleg.konto} />
          <Row label="Kostenstelle" value={beleg.kostenstelle} />
          <Row label="Kostenträger" value={beleg.kostentraeger} />
        </Section>

        {/* Positionen */}
        {beleg.positionen.length > 0 && (
          <Section title="Positionen">
            {beleg.positionen.map((p) => (
              <View key={p.id} style={styles.posRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.posName}>{p.bezeichnung}</Text>
                  <Text style={styles.posMeta}>{p.kategorie} · {p.menge} {p.einheit}</Text>
                </View>
                <Text style={styles.posTotal}>{(p.preis * p.menge).toFixed(2)} €</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Gesamt</Text>
              <Text style={styles.totalValue}>{total.toFixed(2)} €</Text>
            </View>
          </Section>
        )}

        {/* Fotos */}
        {beleg.fotoUris.length > 0 && (
          <Section title={`Fotos (${beleg.fotoUris.length})`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {beleg.fotoUris.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Wünsche & Notizen */}
        {(beleg.wuensche || beleg.interneNotiz) && (
          <Section title="Wünsche & Notizen">
            {beleg.wuensche ? <Row label="Wünsche" value={beleg.wuensche} /> : null}
            {beleg.interneNotiz ? <Row label="Interne Notiz" value={beleg.interneNotiz} /> : null}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3a3b3c' },
  closeBtn: { marginRight: 12 },
  headerTitle: { flex: 1, color: '#e4e6ea', fontSize: 16, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 60 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  orderNrBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1a3a2a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  orderNrText: { color: '#b7e4c7', fontSize: 13, fontWeight: '700' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' as any, borderWidth: 1, borderColor: '#a8dadc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  retryText: { color: '#a8dadc', fontSize: 13, fontWeight: '600' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2a0f1a', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#e94560', fontSize: 12, flex: 1 },

  section: { backgroundColor: '#16213e', borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionTitle: { color: '#a8dadc', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  detailRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#3a3b3c' },
  detailLabel: { color: '#b0b3b8', fontSize: 13, width: 110 },
  detailValue: { color: '#e4e6ea', fontSize: 13, flex: 1, fontWeight: '500' },

  posRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#3a3b3c' },
  posName: { color: '#e4e6ea', fontSize: 14, fontWeight: '600' },
  posMeta: { color: '#b0b3b8', fontSize: 12, marginTop: 2 },
  posTotal: { color: '#a8dadc', fontSize: 14, fontWeight: '700' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 10 },
  totalLabel: { color: '#b0b3b8', fontSize: 14, marginRight: 14 },
  totalValue: { color: '#a8dadc', fontSize: 18, fontWeight: '800' },

  photo: { width: width * 0.7, height: width * 0.7 * 0.75, borderRadius: 12, marginRight: 10, backgroundColor: '#0f3460' },
});

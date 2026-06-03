import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useBelegStore } from '../store/belegStore';
import { BelegCard } from '../components/BelegCard';
import { syncPendingBelege } from '../services/syncService';
import { Bewirtungsbeleg } from '../types';

interface Props {
  onOpenBeleg: (beleg: Bewirtungsbeleg) => void;
}

export function TodayScreen({ onOpenBeleg }: Props) {
  const belege = useBelegStore((s) => s.getTodaysBelege());
  const pending = useBelegStore((s) => s.getPendingBelege());
  const [refreshing, setRefreshing] = React.useState(false);

  const today = format(new Date(), "EEEE, d. MMMM yyyy", { locale: de });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await syncPendingBelege(); } catch { /* ignore */ }
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>EssKlasse</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        {pending.length > 0 && (
          <TouchableOpacity style={styles.syncBadge} onPress={onRefresh}>
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text style={styles.syncBadgeText}>{pending.length} ausstehend</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{belege.length}</Text>
          <Text style={styles.summaryLabel}>Belege heute</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>
            {belege.reduce((s, b) => s + b.personenzahl, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Personen gesamt</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>
            {belege.reduce((s, b) => s + b.positionen.reduce((ps, p) => ps + p.preis * p.menge, 0), 0).toFixed(0)} €
          </Text>
          <Text style={styles.summaryLabel}>Umsatz heute</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={belege}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a8dadc" />}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <BelegCard beleg={item} onPress={() => onOpenBeleg(item)} />
        )}
      />
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="restaurant-outline" size={56} color="#3a3b3c" />
      <Text style={styles.emptyTitle}>Noch keine Bewirtungen heute</Text>
      <Text style={styles.emptyText}>Tippe unten auf + um einen neuen Bewirtungsbeleg anzulegen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  appName: { color: '#e4e6ea', fontSize: 22, fontWeight: '800' },
  dateText: { color: '#b0b3b8', fontSize: 13, marginTop: 2 },

  syncBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e94560', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, gap: 5 },
  syncBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { color: '#a8dadc', fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: '#b0b3b8', fontSize: 11, marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#3a3b3c', marginVertical: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 100 },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: '#e4e6ea', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyText: { color: '#b0b3b8', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bewirtungsbeleg } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  beleg: Bewirtungsbeleg;
  onPress: () => void;
}

export function BelegCard({ beleg, onPress }: Props) {
  const datum = format(parseISO(beleg.cateringDatumVon), 'dd.MM.yyyy', { locale: de });
  const total = beleg.positionen.reduce((s, p) => s + p.preis * p.menge, 0);

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      {/* Header row */}
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name="restaurant" size={22} color="#a8dadc" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title} numberOfLines={1}>{beleg.veranstaltung || 'Bewirtung'}</Text>
          <Text style={styles.sub}>
            {beleg.besteller} · {datum}
          </Text>
        </View>
        <StatusBadge status={beleg.syncStatus} />
      </View>

      {/* Details row */}
      <View style={[styles.row, { marginTop: 10 }]}>
        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={14} color="#b0b3b8" />
          <Text style={styles.detailText}>{beleg.raum || beleg.ort || '—'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={14} color="#b0b3b8" />
          <Text style={styles.detailText}>{beleg.personenzahl} Pers.</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={14} color="#b0b3b8" />
          <Text style={styles.detailText}>{beleg.uhrzeitVon} – {beleg.uhrzeitBis}</Text>
        </View>
      </View>

      {/* BC order number */}
      {beleg.bcAuftragsnummer && (
        <View style={styles.auftragBox}>
          <Ionicons name="checkmark-circle" size={14} color="#b7e4c7" />
          <Text style={styles.auftragText}>BC-Auftrag: {beleg.bcAuftragsnummer}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.row, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#3a3b3c', paddingTop: 8 }]}>
        <Text style={styles.posCnt}>{beleg.positionen.length} Position(en)</Text>
        {beleg.fotoUris.length > 0 && (
          <View style={styles.detailItem}>
            <Ionicons name="camera-outline" size={14} color="#b0b3b8" />
            <Text style={styles.detailText}>{beleg.fotoUris.length} Foto(s)</Text>
          </View>
        )}
        <Text style={styles.total}>{total.toFixed(2)} €</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#e4e6ea', fontSize: 15, fontWeight: '700' },
  sub:   { color: '#b0b3b8', fontSize: 12, marginTop: 2 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  detailText: { color: '#b0b3b8', fontSize: 12, marginLeft: 4 },
  auftragBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#1a3a2a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  auftragText: { color: '#b7e4c7', fontSize: 12, marginLeft: 6, fontWeight: '600' },
  posCnt: { color: '#b0b3b8', fontSize: 12, flex: 1 },
  total:  { color: '#a8dadc', fontSize: 15, fontWeight: '700' },
});

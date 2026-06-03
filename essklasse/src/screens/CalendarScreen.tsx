import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { useBelegStore } from '../store/belegStore';
import { BelegCard } from '../components/BelegCard';
import { Bewirtungsbeleg } from '../types';

interface Props {
  onOpenBeleg: (beleg: Bewirtungsbeleg) => void;
}

export function CalendarScreen({ onOpenBeleg }: Props) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const datesWithBelege = useBelegStore((s) => s.getDatesWithBelege());
  const getBelegeByDate = useBelegStore((s) => s.getBelegeByDate);
  const belege = getBelegeByDate(selectedDate);

  // Build marked dates object for the calendar
  const markedDates: Record<string, any> = {};
  datesWithBelege.forEach((d) => {
    markedDates[d] = {
      marked: true,
      dotColor: '#e94560',
      ...(d === selectedDate ? { selected: true, selectedColor: '#0f3460' } : {}),
    };
  });
  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: '#0f3460' };
  }

  const displayDate = format(parseISO(selectedDate), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Kalender</Text>

      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: '#1a1a2e',
          calendarBackground: '#16213e',
          textSectionTitleColor: '#b0b3b8',
          selectedDayBackgroundColor: '#0f3460',
          selectedDayTextColor: '#e4e6ea',
          todayTextColor: '#e94560',
          dayTextColor: '#e4e6ea',
          textDisabledColor: '#555',
          dotColor: '#e94560',
          selectedDotColor: '#a8dadc',
          arrowColor: '#a8dadc',
          disabledArrowColor: '#555',
          monthTextColor: '#e4e6ea',
          indicatorColor: '#a8dadc',
          textDayFontWeight: '600',
          textMonthFontWeight: '800',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      {/* Selected day header */}
      <View style={styles.dayHeader}>
        <Ionicons name="calendar-outline" size={16} color="#a8dadc" />
        <Text style={styles.dayHeaderText}>{displayDate}</Text>
        <View style={styles.cntBadge}>
          <Text style={styles.cntText}>{belege.length}</Text>
        </View>
      </View>

      <FlatList
        data={belege}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="restaurant-outline" size={40} color="#3a3b3c" />
            <Text style={styles.emptyText}>Keine Bewirtungen an diesem Tag</Text>
          </View>
        }
        renderItem={({ item }) => (
          <BelegCard beleg={item} onPress={() => onOpenBeleg(item)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  title: { color: '#e4e6ea', fontSize: 22, fontWeight: '800', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },

  calendar: { borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', marginBottom: 12 },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  dayHeaderText: { color: '#e4e6ea', fontSize: 14, fontWeight: '600', flex: 1 },
  cntBadge: { backgroundColor: '#e94560', borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cntText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: '#b0b3b8', fontSize: 14, marginTop: 10, textAlign: 'center' },
});

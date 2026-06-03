import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBelegStore } from '../store/belegStore';

export type TabKey = 'today' | 'calendar';

interface Props {
  activeTab: TabKey;
  onTab: (tab: TabKey) => void;
  onNew: () => void;
}

export function BottomNav({ activeTab, onTab, onNew }: Props) {
  const pending = useBelegStore((s) => s.getPendingBelege()).length;

  return (
    <View style={styles.bar}>
      <TabBtn
        icon="today-outline"
        iconActive="today"
        label="Heute"
        active={activeTab === 'today'}
        onPress={() => onTab('today')}
      />

      {/* Center FAB */}
      <TouchableOpacity style={styles.fab} onPress={onNew} activeOpacity={0.85}>
        <Ionicons name="add" size={34} color="#fff" />
      </TouchableOpacity>

      <TabBtn
        icon="calendar-outline"
        iconActive="calendar"
        label="Kalender"
        active={activeTab === 'calendar'}
        onPress={() => onTab('calendar')}
        badge={0}
      />

      {/* Pending sync indicator (global) */}
      {pending > 0 && (
        <View style={styles.pendingDot}>
          <Text style={styles.pendingDotText}>{pending}</Text>
        </View>
      )}
    </View>
  );
}

function TabBtn({
  icon,
  iconActive,
  label,
  active,
  onPress,
  badge,
}: {
  icon: string;
  iconActive: string;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Ionicons
          name={(active ? iconActive : icon) as any}
          size={26}
          color={active ? '#1877f2' : '#b0b3b8'}
        />
        {!!badge && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#3a3b3c',
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { color: '#b0b3b8', fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: '#1877f2' },

  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#e94560',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 16,
    shadowColor: '#e94560',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#e94560',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  pendingDot: {
    position: 'absolute',
    top: 6,
    right: 10,
    backgroundColor: '#e94560',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  pendingDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});

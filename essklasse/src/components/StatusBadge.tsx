import React from 'react';
import { View, Text } from 'react-native';
import { SyncStatus } from '../types';

const CONFIG: Record<SyncStatus, { label: string; bg: string; text: string }> = {
  local:   { label: 'Lokal',       bg: '#3a3b3c', text: '#b0b3b8' },
  syncing: { label: 'Sync …',      bg: '#1877f2', text: '#ffffff' },
  synced:  { label: 'Übertragen',  bg: '#2d6a4f', text: '#b7e4c7' },
  error:   { label: 'Fehler',      bg: '#e94560', text: '#ffffff' },
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  const c = CONFIG[status];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '600' }}>{c.label}</Text>
    </View>
  );
}

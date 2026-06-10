import type { SyncStatus } from '../types';

const MAP: Record<SyncStatus, { label: string; bg: string; color: string; border: string }> = {
  local:   { label: 'Lokal',      bg: '#f5f3f0', color: '#8a8a8a', border: '#e0ddd8' },
  syncing: { label: 'Sync …',     bg: '#fff3e0', color: '#b45309', border: '#fcd99a' },
  synced:  { label: 'Übertragen', bg: '#e8f5ee', color: '#365c42', border: '#c3dfc9' },
  error:   { label: 'Fehler',     bg: '#fdf0f0', color: '#8B1A1A', border: '#f5c6c6' },
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  const c = MAP[status];
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      borderRadius: 8, padding: '3px 9px',
      fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>{c.label}</span>
  );
}

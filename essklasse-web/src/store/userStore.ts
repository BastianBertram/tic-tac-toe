import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppUser } from '../types';
import type { UserRolle } from '../types';

interface UserStore {
  users: AppUser[];
  addUser: (data: { name: string; email: string; rolle: UserRolle; objektIds: string[] }) => void;
  updateUser: (id: string, partial: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  toggleAktiv: (id: string) => void;
  setObjekteForUser: (id: string, objektIds: string[]) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      users: [
        // Demo-Daten
        {
          id: 'demo-admin',
          name: 'Max Mustermann',
          email: 'max@hwk-hannover.de',
          rolle: 'admin',
          objektIds: [],
          aktiv: true,
          erstelltAm: new Date().toISOString(),
        },
        {
          id: 'demo-user-1',
          name: 'Anna Schmidt',
          email: 'anna@hwk-hannover.de',
          rolle: 'user',
          objektIds: ['demo-1'],
          aktiv: true,
          erstelltAm: new Date().toISOString(),
        },
        {
          id: 'demo-buch-1',
          name: 'Klaus Weber',
          email: 'buchhaltung@hwk-hannover.de',
          rolle: 'buchhaltung',
          objektIds: [],
          aktiv: true,
          erstelltAm: new Date().toISOString(),
        },
      ],

      addUser: (data) =>
        set(s => ({
          users: [...s.users, {
            ...data,
            id: uuidv4(),
            aktiv: true,
            erstelltAm: new Date().toISOString(),
          }],
        })),

      updateUser: (id, partial) =>
        set(s => ({ users: s.users.map(u => u.id === id ? { ...u, ...partial } : u) })),

      deleteUser: (id) =>
        set(s => ({ users: s.users.filter(u => u.id !== id) })),

      toggleAktiv: (id) =>
        set(s => ({ users: s.users.map(u => u.id === id ? { ...u, aktiv: !u.aktiv } : u) })),

      setObjekteForUser: (id, objektIds) =>
        set(s => ({ users: s.users.map(u => u.id === id ? { ...u, objektIds } : u) })),
    }),
    { name: 'ek-users' }
  )
);

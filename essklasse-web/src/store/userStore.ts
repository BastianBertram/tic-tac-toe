import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { AppUser, Anrede } from '../types';
import type { UserRolle } from '../types';

type NewUserData = {
  anrede: Anrede;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  rolle: UserRolle;
  objektIds: string[];
};

interface UserStore {
  users: AppUser[];
  addUser: (data: NewUserData) => void;
  updateUser: (id: string, partial: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  toggleAktiv: (id: string) => void;
  setObjekteForUser: (id: string, objektIds: string[]) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      users: [
        {
          id: 'demo-admin',
          anrede: 'Herr',
          vorname: 'Max',
          nachname: 'Mustermann',
          name: 'Max Mustermann',
          email: 'max@hwk-hannover.de',
          telefon: '',
          rolle: 'admin',
          objektIds: [],
          aktiv: true,
          erstelltAm: new Date().toISOString(),
        },
        {
          id: 'demo-user-1',
          anrede: 'Frau',
          vorname: 'Anna',
          nachname: 'Schmidt',
          name: 'Anna Schmidt',
          email: 'anna@hwk-hannover.de',
          telefon: '',
          rolle: 'user',
          objektIds: ['demo-1'],
          aktiv: true,
          erstelltAm: new Date().toISOString(),
        },
        {
          id: 'demo-buch-1',
          anrede: 'Herr',
          vorname: 'Klaus',
          nachname: 'Weber',
          name: 'Klaus Weber',
          email: 'buchhaltung@hwk-hannover.de',
          telefon: '',
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
            name: `${data.vorname} ${data.nachname}`,
            id: uuidv4(),
            aktiv: true,
            erstelltAm: new Date().toISOString(),
          }],
        })),

      updateUser: (id, partial) =>
        set(s => ({
          users: s.users.map(u => {
            if (u.id !== id) return u;
            const updated = { ...u, ...partial };
            // name immer synchron halten
            updated.name = `${updated.vorname} ${updated.nachname}`;
            return updated;
          }),
        })),

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

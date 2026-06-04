# Auth Implementation Guide – EssKlasse Web-App
**For AI Coding Agents · Passwordless Magic-Link Login · Admin-controlled User Management**

---

## Overview

Implement a **passwordless magic-link login** system:
1. User enters their email → receives a one-time login link via email
2. User clicks the link → is authenticated and redirected into the app
3. Without a valid session, every route shows only the login screen
4. Users can only be created by an admin (no self-registration)

**Stack:**
- Frontend: React + Vite (existing `src/` structure)
- Backend: Node.js + Express (new `server/` directory)
- Database: SQLite via `better-sqlite3` (file-based, no server needed)
- Email: Nodemailer + SMTP (configurable via `.env`)
- Sessions: JWT (short-lived access token in `localStorage` + HttpOnly refresh cookie)

---

## Step 1 – Backend project setup

### 1.1 Create the server directory and install dependencies

```bash
mkdir -p server
cd server
npm init -y
npm install express better-sqlite3 nodemailer jsonwebtoken uuid dotenv cors cookie-parser
npm install --save-dev @types/node tsx nodemon
```

### 1.2 Create `server/.env`

```env
# Server
PORT=3001
FRONTEND_URL=http://localhost:5173

# JWT
JWT_ACCESS_SECRET=REPLACE_WITH_32_CHAR_RANDOM_STRING
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_32_CHAR_STRING
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Magic link
MAGIC_LINK_EXPIRES_MINUTES=15

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@essklasse-catering.de
SMTP_PASS=YOUR_SMTP_PASSWORD
EMAIL_FROM="EssKlasse Catering <noreply@essklasse-catering.de>"

# Admin seed (created on first start if DB is empty)
ADMIN_EMAIL=admin@essklasse-catering.de
ADMIN_NAME=Administrator
```

### 1.3 Add `server/package.json` scripts

```json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

---

## Step 2 – Database schema

### 2.1 Create `server/src/db.ts`

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR  = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'essklasse.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

### 2.2 Create `server/src/migrations.ts`

```typescript
import { db } from './db';

export function runMigrations() {
  db.exec(`
    -- ── users ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,          -- UUID v4
      email       TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL DEFAULT '',
      role        TEXT NOT NULL DEFAULT 'user'  -- 'admin' | 'user'
        CHECK(role IN ('admin','user')),
      is_active   INTEGER NOT NULL DEFAULT 1,   -- 0 = deactivated
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      created_by  TEXT,                          -- id of admin who created this user
      last_login  TEXT
    );

    -- ── magic_links ────────────────────────────────────────────────
    --  One-time tokens sent by email.
    --  Consumed (deleted) on first use.
    CREATE TABLE IF NOT EXISTS magic_links (
      id          TEXT PRIMARY KEY,          -- UUID v4 (the token itself)
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      expires_at  TEXT NOT NULL,             -- ISO datetime
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── refresh_tokens ─────────────────────────────────────────────
    --  Long-lived tokens stored in HttpOnly cookies.
    --  Revocable per-device.
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,          -- UUID v4
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT UNIQUE NOT NULL,      -- SHA-256 of the raw token
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      user_agent  TEXT,
      ip          TEXT
    );

    -- Index: fast lookup of magic links by token
    CREATE INDEX IF NOT EXISTS idx_magic_links_id ON magic_links(id);

    -- Index: fast lookup of refresh tokens
    CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);

    -- Index: find all users created by a given admin
    CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
  `);
}
```

### 2.3 Create `server/src/seed.ts` (admin user on first start)

```typescript
import { db }  from './db';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

export function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (existing) return; // Admin already exists

  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminName  = process.env.ADMIN_NAME ?? 'Administrator';

  db.prepare(`
    INSERT INTO users (id, email, name, role, is_active)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(uuidv4(), adminEmail, adminName);

  console.log(`✅ Admin user seeded: ${adminEmail}`);
}
```

---

## Step 3 – Auth utilities

### 3.1 Create `server/src/utils/tokens.ts`

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

export interface AccessPayload {
  sub: string;   // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<AccessPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessPayload;
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { sub: string };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

### 3.2 Create `server/src/utils/email.ts`

```typescript
import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMagicLink(to: string, name: string, token: string) {
  const url = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
  const expires = process.env.MAGIC_LINK_EXPIRES_MINUTES ?? '15';

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: 'Ihr Anmelde-Link – EssKlasse',
    html: `
      <!DOCTYPE html>
      <html lang="de">
      <body style="font-family: -apple-system, sans-serif; background: #f5f3f0; padding: 32px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff;
                    border-radius: 16px; padding: 32px; border: 1px solid #e0ddd8;">
          <img src="https://essklasse-catering.de/wp-content/uploads/2022/05/logo.webp"
               alt="EssKlasse" style="height: 48px; margin-bottom: 24px;" />
          <h2 style="color: #2e2e2e; margin: 0 0 8px;">Hallo ${name},</h2>
          <p style="color: #5a5a5a; line-height: 1.6;">
            Sie haben eine Anmeldung bei EssKlasse angefordert.<br>
            Klicken Sie auf den Button, um sich einzuloggen:
          </p>
          <a href="${url}"
             style="display: inline-block; margin: 24px 0;
                    background: #8B1A1A; color: #fff;
                    padding: 14px 28px; border-radius: 10px;
                    text-decoration: none; font-weight: 700; font-size: 16px;">
            Jetzt einloggen
          </a>
          <p style="color: #8a8a8a; font-size: 13px;">
            Dieser Link ist ${expires} Minuten gültig und kann nur einmal verwendet werden.<br>
            Falls Sie keine Anmeldung angefordert haben, können Sie diese E-Mail ignorieren.
          </p>
          <hr style="border: none; border-top: 1px solid #e0ddd8; margin: 24px 0;" />
          <p style="color: #8a8a8a; font-size: 12px;">
            EssKlasse Catering &amp; Gastronomie · HWK Hannover
          </p>
        </div>
      </body>
      </html>
    `,
  });
}
```

---

## Step 4 – Express routes

### 4.1 Create `server/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Nur Administratoren haben Zugriff.' });
    }
    next();
  });
}
```

### 4.2 Create `server/src/routes/auth.ts`

```typescript
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 }  from 'uuid';
import { db }            from '../db';
import { sendMagicLink } from '../utils/email';
import {
  generateMagicToken, hashToken,
  signAccessToken, signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens';
import { requireAuth, AuthRequest } from '../middleware/auth';
import 'dotenv/config';

const router = Router();

// ── POST /auth/login ─────────────────────────────────────────────
// Step 1: User submits email → receive magic link
router.post('/login', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'E-Mail-Adresse erforderlich.' });
  }

  const user = db.prepare(
    'SELECT id, name, email, is_active FROM users WHERE email = ? COLLATE NOCASE'
  ).get(email.trim().toLowerCase()) as any;

  // Always return 200 to prevent user enumeration
  if (!user || !user.is_active) {
    return res.json({ message: 'Falls diese E-Mail registriert ist, wurde ein Link gesendet.' });
  }

  // Invalidate any existing unused links for this user
  db.prepare('DELETE FROM magic_links WHERE user_id = ? AND used = 0').run(user.id);

  const token     = generateMagicToken();
  const expiresAt = new Date(
    Date.now() + Number(process.env.MAGIC_LINK_EXPIRES_MINUTES ?? 15) * 60 * 1000
  ).toISOString();

  db.prepare(
    'INSERT INTO magic_links (id, user_id, email, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, user.id, user.email, expiresAt);

  await sendMagicLink(user.email, user.name || user.email, token);

  return res.json({ message: 'Falls diese E-Mail registriert ist, wurde ein Link gesendet.' });
});

// ── GET /auth/verify?token=... ───────────────────────────────────
// Step 2: User clicks email link → exchange token for session
router.get('/verify', (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Ungültiger Link.' });
  }

  const link = db.prepare(
    'SELECT * FROM magic_links WHERE id = ? AND used = 0'
  ).get(token) as any;

  if (!link) {
    return res.status(401).json({ error: 'Dieser Link ist ungültig oder wurde bereits verwendet.' });
  }

  if (new Date(link.expires_at) < new Date()) {
    db.prepare('DELETE FROM magic_links WHERE id = ?').run(token);
    return res.status(401).json({ error: 'Dieser Link ist abgelaufen. Bitte fordern Sie einen neuen an.' });
  }

  // Mark link as used
  db.prepare('UPDATE magic_links SET used = 1 WHERE id = ?').run(token);

  const user = db.prepare(
    'SELECT id, email, name, role, is_active FROM users WHERE id = ?'
  ).get(link.user_id) as any;

  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'Ihr Konto ist deaktiviert.' });
  }

  // Update last_login
  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

  // Issue tokens
  const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshRaw   = signRefreshToken({ sub: user.id });
  const refreshHash  = hashToken(refreshRaw);
  const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(), user.id, refreshHash, refreshExpires,
    req.headers['user-agent'] ?? '', req.ip ?? ''
  );

  // Set refresh token as HttpOnly cookie
  res.cookie('ek_refresh', refreshRaw, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/auth/refresh',
  });

  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// ── POST /auth/refresh ───────────────────────────────────────────
// Exchange refresh cookie for new access token
router.post('/refresh', (req: Request, res: Response) => {
  const raw = req.cookies?.ek_refresh;
  if (!raw) return res.status(401).json({ error: 'Keine Sitzung gefunden.' });

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(raw);
  } catch {
    return res.status(401).json({ error: 'Sitzung abgelaufen.' });
  }

  const hash    = hashToken(raw);
  const stored  = db.prepare(
    'SELECT * FROM refresh_tokens WHERE token_hash = ?'
  ).get(hash) as any;

  if (!stored || new Date(stored.expires_at) < new Date()) {
    res.clearCookie('ek_refresh', { path: '/auth/refresh' });
    return res.status(401).json({ error: 'Sitzung abgelaufen.' });
  }

  const user = db.prepare(
    'SELECT id, email, name, role, is_active FROM users WHERE id = ?'
  ).get(payload.sub) as any;

  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'Konto deaktiviert.' });
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// ── POST /auth/logout ────────────────────────────────────────────
router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  const raw = req.cookies?.ek_refresh;
  if (raw) {
    const hash = hashToken(raw);
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
  }
  res.clearCookie('ek_refresh', { path: '/auth/refresh' });
  return res.json({ message: 'Erfolgreich abgemeldet.' });
});

// ── GET /auth/me ─────────────────────────────────────────────────
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, email, name, role, last_login FROM users WHERE id = ?'
  ).get(req.user!.id) as any;
  return res.json(user);
});

export default router;
```

### 4.3 Create `server/src/routes/admin.ts`

```typescript
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db }           from '../db';
import { requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);  // all routes below require admin

// ── GET /admin/users ─────────────────────────────────────────────
router.get('/users', (req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, u.last_login,
           c.email AS created_by_email
    FROM users u
    LEFT JOIN users c ON c.id = u.created_by
    ORDER BY u.created_at DESC
  `).all();
  return res.json(users);
});

// ── POST /admin/users ────────────────────────────────────────────
router.post('/users', (req: AuthRequest, res: Response) => {
  const { email, name, role = 'user' } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'E-Mail-Adresse erforderlich.' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' });
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO users (id, email, name, role, is_active, created_by) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(id, email.trim().toLowerCase(), name ?? '', role, req.user!.id);

  const user = db.prepare('SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?').get(id);
  return res.status(201).json(user);
});

// ── PATCH /admin/users/:id ───────────────────────────────────────
router.patch('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, role, is_active } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

  // Prevent admin from deactivating themselves
  if (id === req.user!.id && is_active === 0) {
    return res.status(400).json({ error: 'Sie können sich nicht selbst deaktivieren.' });
  }

  if (name       !== undefined) db.prepare('UPDATE users SET name       = ? WHERE id = ?').run(name, id);
  if (role       !== undefined) db.prepare('UPDATE users SET role       = ? WHERE id = ?').run(role, id);
  if (is_active  !== undefined) db.prepare('UPDATE users SET is_active  = ? WHERE id = ?').run(is_active ? 1 : 0, id);

  const updated = db.prepare('SELECT id, email, name, role, is_active FROM users WHERE id = ?').get(id);
  return res.json(updated);
});

// ── DELETE /admin/users/:id ──────────────────────────────────────
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Sie können sich nicht selbst löschen.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return res.json({ message: 'Benutzer gelöscht.' });
});

export default router;
```

### 4.4 Create `server/src/index.ts` (main entry)

```typescript
import 'dotenv/config';
import express     from 'express';
import cors        from 'cors';
import cookieParser from 'cookie-parser';
import { runMigrations } from './migrations';
import { seedAdmin }     from './seed';
import authRoutes        from './routes/auth';
import adminRoutes       from './routes/admin';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ── Database ─────────────────────────────────────────────────────
runMigrations();
seedAdmin();

// ── Routes ───────────────────────────────────────────────────────
app.use('/auth',  authRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🚀 EssKlasse API running on http://localhost:${PORT}`);
});
```

---

## Step 5 – Frontend auth store & API client

### 5.1 Create `src/store/authStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthStore {
  user:        AuthUser | null;
  accessToken: string | null;
  setAuth:     (user: AuthUser, token: string) => void;
  setToken:    (token: string) => void;
  logout:      () => void;
  isAdmin:     () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:        null,
      accessToken: null,

      setAuth: (user, accessToken) => set({ user, accessToken }),
      setToken: (accessToken)      => set({ accessToken }),
      logout:  ()                  => set({ user: null, accessToken: null }),
      isAdmin: ()                  => get().user?.role === 'admin',
    }),
    {
      name: 'ek-auth',
      // Only persist user identity, NOT the access token
      // (token is refreshed from the HttpOnly cookie on reload)
      partialize: (s) => ({ user: s.user }),
    }
  )
);
```

### 5.2 Create `src/services/apiClient.ts`

```typescript
import { useAuthStore } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method:      'POST',
    credentials: 'include',  // sends the HttpOnly cookie
  });
  if (!res.ok) {
    useAuthStore.getState().logout();
    return null;
  }
  const data = await res.json();
  useAuthStore.getState().setToken(data.accessToken);
  return data.accessToken as string;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let token = useAuthStore.getState().accessToken;

  const doFetch = (t: string | null) =>
    fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(token);

  // Access token expired → try refresh once
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }

  return res;
}
```

### 5.3 Add `VITE_API_URL` to `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ANTHROPIC_API_KEY: string;
}
```

### 5.4 Create `.env` in the frontend root (`essklasse-web/.env`)

```env
VITE_API_URL=http://localhost:3001
```

---

## Step 6 – Frontend login screens

### 6.1 Create `src/screens/LoginScreen.tsx`

```tsx
import { useState } from 'react';
import s from './LoginScreen.module.css';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Stage = 'email' | 'sent';

export function LoginScreen() {
  const [stage,   setStage]   = useState<Stage>('email');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setStage('sent');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />

        {stage === 'email' ? (
          <>
            <h1 className={s.title}>Anmelden</h1>
            <p className={s.subtitle}>
              Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Anmelde-Link.
            </p>
            <form onSubmit={handleSubmit} className={s.form}>
              <label className={s.label}>E-Mail-Adresse</label>
              <input
                type="email" required autoFocus
                className={s.input}
                placeholder="name@beispiel.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {error && <div className={s.error}>{error}</div>}
              <button type="submit" className={s.btn} disabled={loading}>
                {loading ? 'Wird gesendet …' : 'Anmelde-Link anfordern'}
              </button>
            </form>
          </>
        ) : (
          <div className={s.sentBox}>
            <div className={s.sentIcon}>📧</div>
            <h2 className={s.sentTitle}>Link gesendet!</h2>
            <p className={s.sentText}>
              Wir haben eine E-Mail an <strong>{email}</strong> gesendet.<br />
              Klicken Sie auf den Link in der E-Mail, um sich anzumelden.<br />
              <span className={s.sentNote}>Der Link ist 15 Minuten gültig.</span>
            </p>
            <button
              className={s.btnGhost}
              onClick={() => { setStage('email'); setEmail(''); }}
              type="button"
            >
              Andere E-Mail verwenden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 6.2 Create `src/screens/LoginScreen.module.css`

```css
.page {
  min-height: 100dvh; display: flex;
  align-items: center; justify-content: center;
  background: var(--ek-bg); padding: 24px;
}
.card {
  background: var(--ek-surface);
  border-radius: 20px; padding: 36px 28px;
  width: 100%; max-width: 400px;
  border: 1px solid var(--ek-border);
  box-shadow: 0 8px 32px rgba(0,0,0,.08);
}
.logo { height: 48px; display: block; margin: 0 auto 28px; }
.title    { font-size: 22px; font-weight: 900; color: var(--ek-charcoal); margin-bottom: 8px; text-align: center; }
.subtitle { font-size: 14px; color: var(--ek-muted); text-align: center; line-height: 1.5; margin-bottom: 24px; }
.form  { display: flex; flex-direction: column; gap: 10px; }
.label { font-size: 12px; font-weight: 700; color: var(--ek-muted); text-transform: uppercase; letter-spacing: .5px; }
.input { padding: 13px 14px; font-size: 15px; border: 1.5px solid var(--ek-border); border-radius: 10px; background: var(--ek-surface2); }
.input:focus { border-color: var(--ek-red); outline: none; box-shadow: 0 0 0 3px rgba(139,26,26,.1); }
.error { background: #fdf0f0; color: var(--ek-red); border-radius: 8px; padding: 10px 12px; font-size: 13px; border: 1px solid #f5c6c6; }
.btn { padding: 14px; background: var(--ek-red); color: #fff; border-radius: 10px; font-size: 16px; font-weight: 700; margin-top: 6px; }
.btn:disabled { opacity: .65; cursor: not-allowed; }

.sentBox   { text-align: center; }
.sentIcon  { font-size: 56px; margin-bottom: 16px; }
.sentTitle { font-size: 20px; font-weight: 800; color: var(--ek-charcoal); margin-bottom: 12px; }
.sentText  { font-size: 14px; color: var(--ek-gray); line-height: 1.7; margin-bottom: 8px; }
.sentNote  { font-size: 12px; color: var(--ek-muted); }
.btnGhost  { margin-top: 24px; padding: 12px 24px; background: transparent; color: var(--ek-red); border: 1.5px solid var(--ek-red); border-radius: 10px; font-size: 14px; font-weight: 700; }
```

### 6.3 Create `src/screens/VerifyScreen.tsx` (handles the email link click)

```tsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import s from './LoginScreen.module.css';  // reuse login styles

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface Props { onSuccess: () => void; }

export function VerifyScreen({ onSuccess }: Props) {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const setAuth = useAuthStore(s => s.setAuth);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setStatus('error'); setMessage('Kein Token gefunden.'); return; }

    fetch(`${BASE}/auth/verify?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error ?? 'Fehler');
        setAuth(data.user, data.accessToken);
        setStatus('success');
        // Remove token from URL, then navigate to home
        window.history.replaceState({}, '', '/');
        setTimeout(onSuccess, 800);
      })
      .catch(e => { setStatus('error'); setMessage(e.message); });
  }, []);

  return (
    <div className={s.page}>
      <div className={s.card}>
        <img src="/logo.webp" alt="EssKlasse" className={s.logo} />
        {status === 'verifying' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p>Anmeldung wird überprüft …</p>
          </div>
        )}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <p>Erfolgreich angemeldet!</p>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h3 style={{ marginBottom: 8 }}>Anmeldung fehlgeschlagen</h3>
            <p style={{ color: 'var(--ek-muted)', marginBottom: 20 }}>{message}</p>
            <a href="/" style={{ color: 'var(--ek-red)', fontWeight: 700 }}>Zurück zur Anmeldung</a>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 7 – Route guard & App.tsx wiring

### 7.1 Create `src/components/AuthGuard.tsx`

```tsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoginScreen }  from '../screens/LoginScreen';
import { VerifyScreen } from '../screens/VerifyScreen';

interface Props { children: React.ReactNode; }

export function AuthGuard({ children }: Props) {
  const { user, setAuth, setToken } = useAuthStore();
  const [checked, setChecked] = useState(false);

  const isVerifyRoute = window.location.pathname === '/auth/verify' ||
                        window.location.search.includes('token=');

  // On mount: try silent token refresh from cookie
  useEffect(() => {
    if (user) { setChecked(true); return; }

    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/auth/refresh`, {
      method: 'POST', credentials: 'include',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accessToken) {
          setAuth(data.user, data.accessToken);
        }
      })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <span style={{ color: 'var(--ek-muted)', fontSize: 14 }}>Wird geladen …</span>
      </div>
    );
  }

  if (isVerifyRoute) {
    return <VerifyScreen onSuccess={() => window.location.replace('/')} />;
  }

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}
```

### 7.2 Wrap `App.tsx` with `AuthGuard`

```tsx
// In src/App.tsx – wrap the entire return with <AuthGuard>:

import { AuthGuard } from './components/AuthGuard';

export default function App() {
  // ... existing state ...

  return (
    <AuthGuard>
      <div className={s.app}>
        {/* ... existing app content unchanged ... */}
      </div>
    </AuthGuard>
  );
}
```

---

## Step 8 – Admin user management screen (optional but recommended)

### 8.1 Create `src/screens/AdminScreen.tsx`

Build this screen only if `useAuthStore.getState().isAdmin()` is true.
It should:

1. **List all users** — `GET /admin/users` → show table with name, email, role, status, last login
2. **Create user** — form with email + name + role → `POST /admin/users`
3. **Toggle active** — switch per row → `PATCH /admin/users/:id { is_active: 0|1 }`
4. **Delete user** — confirm dialog → `DELETE /admin/users/:id`

Add an **Admin** tab to `BottomNav` that only renders when `isAdmin()` is true.

---

## Step 9 – Add logout button

In the app header (TodayScreen / CalendarScreen), add a logout button for the current user:

```tsx
import { useAuthStore } from '../store/authStore';
import { apiFetch }     from '../services/apiClient';

function LogoutButton() {
  const logout = useAuthStore(s => s.logout);
  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    logout();
  }
  return (
    <button onClick={handleLogout} style={{ background: 'transparent', color: 'var(--ek-muted)', fontSize: 13 }}>
      Abmelden
    </button>
  );
}
```

---

## Step 10 – Run everything

### 10.1 Start backend

```bash
cd server
npm run dev
# → "🚀 EssKlasse API running on http://localhost:3001"
# → "✅ Admin user seeded: admin@essklasse-catering.de"
```

### 10.2 Start frontend

```bash
cd essklasse-web
npm run dev
# → http://localhost:5173
```

### 10.3 First login test

1. Open `http://localhost:5173` → login screen appears
2. Enter `admin@essklasse-catering.de`
3. Check the terminal/email for the magic link (in dev, log it to console instead of sending email)
4. Open the link → redirected into the app as admin

### 10.4 Create a regular user

1. Log in as admin → Admin tab → „Neuer Benutzer"
2. Enter email + name → Save
3. User receives a welcome email? (optional: send a welcome magic link immediately on creation)

---

## Security checklist

| Item | Implemented |
|---|---|
| Magic links are single-use (deleted after use) | ✅ Step 4.2 |
| Magic links expire after 15 min | ✅ Step 4.2 |
| Refresh tokens stored as SHA-256 hash | ✅ Step 3.1 |
| Refresh token in HttpOnly cookie (not accessible to JS) | ✅ Step 4.2 |
| Access token short-lived (15 min) | ✅ Step 3.1 |
| Deactivated users cannot log in | ✅ Step 4.2 |
| No self-registration (admin only) | ✅ Step 4.3 |
| Email enumeration prevention (always 200) | ✅ Step 4.2 |
| Admin cannot delete/deactivate themselves | ✅ Step 4.3 |
| CORS restricted to frontend URL | ✅ Step 4.4 |
| Old magic links invalidated on new login request | ✅ Step 4.2 |

---

## Database file location

```
server/
  data/
    essklasse.db     ← SQLite database (add to .gitignore!)
```

Add to `server/.gitignore`:
```
data/
.env
node_modules/
```

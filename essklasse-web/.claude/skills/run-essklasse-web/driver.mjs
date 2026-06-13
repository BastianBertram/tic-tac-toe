#!/usr/bin/env node
/**
 * Driver for the essklasse-web app — launch, screenshot, and smoke-test
 * both the Vite frontend (5173) and the zero-dependency Node backend (3001).
 *
 * Zero npm dependencies: uses node:child_process, the built-in fetch, and a
 * headless Chrome/Chromium binary for screenshots.
 *
 * Usage (run from the essklasse-web/ directory):
 *   node .claude/skills/run-essklasse-web/driver.mjs e2e          # full flow: up → screenshot → API smoke → down
 *   node .claude/skills/run-essklasse-web/driver.mjs screenshot [out.png] [url]   # against already-running servers
 *   node .claude/skills/run-essklasse-web/driver.mjs smoke        # backend access-control smoke only (own temp port)
 *
 * Env:
 *   CHROME      path to a Chrome/Chromium binary (default: macOS Google Chrome, else `which chromium`)
 *   FRONT_PORT  Vite port (default 5173)
 *   API_PORT    backend port (default 3001)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd());            // expected: …/essklasse-web
const FRONT_PORT = Number(process.env.FRONT_PORT ?? 5173);
const API_PORT   = Number(process.env.API_PORT ?? 3001);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  for (const c of ['chromium', 'chromium-browser', 'google-chrome']) {
    const r = spawnSync('which', [c]);
    if (r.status === 0) return r.stdout.toString().trim();
  }
  throw new Error('No Chrome/Chromium found. Set CHROME=/path/to/chrome.');
}

async function waitForHttp(url, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { await fetch(url); return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`${label} did not come up at ${url}`);
}

function shot(url, out) {
  mkdirSync(dirname(out), { recursive: true });
  const chrome = findChrome();
  const r = spawnSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1100,1400', `--screenshot=${out}`, url,
  ], { stdio: 'ignore' });
  if (!existsSync(out)) throw new Error(`screenshot failed (chrome exit ${r.status})`);
  console.log(`📸 ${out}`);
}

/** Backend access-control smoke: the object-scoping that most PRs touch. */
async function apiSmoke(port) {
  const get = async (email, coll) => {
    const res = await fetch(`http://localhost:${port}/api/data/${coll}`, {
      headers: { 'X-User-Email': email, 'X-Device-Id': `smoke-${email}` },
    });
    const j = await res.json();
    return { status: res.status, j };
  };
  const fails = [];
  const check = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

  // anna = user assigned to demo-1/demo-2 → only those objekte, never demo-3
  const anna = await get('anna@hwk-hannover.de', 'objekte');
  const annaIds = (anna.j.data?.objekte ?? []).map(o => o.id).sort();
  check(JSON.stringify(annaIds) === JSON.stringify(['demo-1', 'demo-2']),
    `user anna sees only [demo-1,demo-2] (got ${JSON.stringify(annaIds)})`);

  // admin → unrestricted (sees all seeded objekte, incl. demo-3)
  const admin = await get('max@hwk-hannover.de', 'objekte');
  const adminIds = (admin.j.data?.objekte ?? []).map(o => o.id);
  check(adminIds.includes('demo-3'), `admin sees all objekte incl. demo-3 (got ${JSON.stringify(adminIds)})`);

  // user may NOT write users (admin-only) → 403
  const put = await fetch(`http://localhost:${port}/api/data/users`, {
    method: 'PUT',
    headers: { 'X-User-Email': 'anna@hwk-hannover.de', 'X-Device-Id': 'smoke', 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: [{ id: 'demo-user-1', rolle: 'admin' }] }),
  });
  check(put.status === 403, `user PUT /api/data/users is rejected 403 (got ${put.status})`);

  return fails;
}

function startBackend(port) {
  const p = spawn('node', ['--env-file-if-exists=.env', 'server/index.mjs'],
    { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'inherit' });
  return p;
}
function startVite(port) {
  const p = spawn('npx', ['vite', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'inherit' });
  return p;
}

async function cmdE2E() {
  const api = startBackend(API_PORT);
  const vite = startVite(FRONT_PORT);
  const kill = () => { try { api.kill(); } catch {} try { vite.kill(); } catch {} };
  process.on('exit', kill); process.on('SIGINT', () => { kill(); process.exit(130); });
  try {
    await waitForHttp(`http://localhost:${API_PORT}/api/data/objekte`, 'backend');
    await waitForHttp(`http://localhost:${FRONT_PORT}/`, 'vite');
    console.log('— both servers up —');
    await sleep(1500); // let the SPA hydrate before the single-shot screenshot
    shot(`http://localhost:${FRONT_PORT}/`, resolve(ROOT, 'tmp/run-essklasse-web/home.png'));
    const fails = await apiSmoke(API_PORT);
    kill();
    if (fails.length) { console.error(`\n❌ ${fails.length} smoke check(s) failed`); process.exit(1); }
    console.log('\n✅ e2e ok');
  } finally { kill(); }
}

async function cmdScreenshot() {
  const out = resolve(ROOT, process.argv[3] ?? 'tmp/run-essklasse-web/home.png');
  const url = process.argv[4] ?? `http://localhost:${FRONT_PORT}/`;
  shot(url, out);
}

async function cmdSmoke() {
  const port = API_PORT + 100; // own port so it doesn't collide with a running backend
  const api = startBackend(port);
  try {
    await waitForHttp(`http://localhost:${port}/api/data/objekte`, 'backend');
    const fails = await apiSmoke(port);
    api.kill();
    if (fails.length) process.exit(1);
    console.log('\n✅ smoke ok');
  } finally { try { api.kill(); } catch {} }
}

const cmd = process.argv[2];
const map = { e2e: cmdE2E, screenshot: cmdScreenshot, smoke: cmdSmoke };
(map[cmd] ?? (() => { console.error('usage: driver.mjs <e2e|screenshot|smoke>'); process.exit(2); }))();

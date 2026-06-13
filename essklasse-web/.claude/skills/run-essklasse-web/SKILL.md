---
name: run-essklasse-web
description: Build, launch, screenshot, and smoke-test the essklasse-web app (EssKlasse Bewirtungs-/catering manager). Use when asked to run, start, serve, build, screenshot, or test the essklasse web app or its Node backend / API.
---

# Run essklasse-web

EssKlasse is a single-page **React 19 + TypeScript + Vite** app (catering /
"Bewirtung" management) backed by a **zero-dependency Node HTTP server**
(`server/index.mjs`) that holds the Anthropic API key, serves JSON
collections from `server/data/*.json`, and enforces object-level access
control. Two processes: **Vite** on `5173` (frontend) and the **Node
backend** on `3001` (`/api/...`).

It is driven by [`.claude/skills/run-essklasse-web/driver.mjs`](.claude/skills/run-essklasse-web/driver.mjs)
— a zero-dependency Node script that launches both servers, screenshots the
SPA with headless Chrome, and runs a backend access-control smoke test.

**All paths below are relative to `essklasse-web/` — run everything from there.**

## Prerequisites

- Node 20+ (verified on v25.6.1) and `npm`. No global tools needed — the
  driver and backend have **no npm dependencies**; Vite/React come from
  `node_modules`.
- A Chrome/Chromium binary for screenshots. On macOS the driver auto-detects
  `/Applications/Google Chrome.app`. Otherwise set `CHROME=/path/to/chromium`.
- Install deps once:

```bash
npm install
```

- AI features need an Anthropic key in a local `.env` (`ANTHROPIC_API_KEY=…`);
  **never commit it**. The app and backend start fine without it — only the
  AI endpoints fail. Data files in `server/data/` are gitignored and
  auto-seeded on first backend start (`ensureSeeded`).
- **Production auth** requires `EK_AUTH_SECRET` (≥32 chars) in the environment —
  it signs the session tokens. With `NODE_ENV=production` and no secret the
  server logs a FATAL line and refuses to issue sessions (verify → 500,
  fail-closed). In dev an ephemeral secret is generated (sessions reset on
  restart). Sessions persist to `server/data/sessions.json` (gitignored).

## Build

Use the bundler directly — it produces `dist/` and runs in well under a second:

```bash
npx vite build         # → dist/ (verified: "✓ built in 188ms")
```

⚠️ `npm run build` runs `tsc -b && vite build` and **currently fails at the
`tsc -b` typecheck** on pre-existing errors in the sales screens
(`AdminScreen.tsx` ROLLE_LABELS/ROLLE_COLORS missing the `sales` role,
unused `SALES_PIPELINE`, a possibly-undefined `anfrage`). The bundle itself
builds fine via `npx vite build`; the dev server doesn't typecheck either.
Fix those type errors before relying on `npm run build`.

## Run — agent path (driver)

From `essklasse-web/`. The driver is the primary way to drive the app.

**Full end-to-end** (launch both servers → screenshot → API smoke → tear down):

```bash
node .claude/skills/run-essklasse-web/driver.mjs e2e
```

Screenshot lands at `tmp/run-essklasse-web/home.png` (gitignored). Use
alternate ports if `5173`/`3001` are busy:

```bash
FRONT_PORT=5180 API_PORT=3010 node .claude/skills/run-essklasse-web/driver.mjs e2e
```

**Backend access-control smoke only** (starts its own backend on `API_PORT+100`,
asserts object-scoping, exits non-zero on failure):

```bash
node .claude/skills/run-essklasse-web/driver.mjs smoke
```

Checks performed (the access-control logic most changes touch):
- `user` anna (assigned demo-1/demo-2) sees **only** those objekte, never demo-3.
- `admin` sees **all** objekte incl. demo-3.
- `user` PUT `/api/data/users` is rejected **403** (admin-only).

**Screenshot against already-running servers** (e.g. after `npm run dev`):

```bash
node .claude/skills/run-essklasse-web/driver.mjs screenshot tmp/shot.png http://localhost:5173/
```

Then **look at the PNG** — a blank/error page means the SPA didn't hydrate
(see Gotchas).

### Driving the backend directly with curl

The backend trusts an `X-User-Email` header for identity **only when started
with `EK_DEV_HEADERS=1`** (the dev role-switcher path). Without that flag — and
always in `NODE_ENV=production` — every `/api/data` request needs a real session
cookie and returns **401** otherwise (fail-closed). Use `npm run dev:api` (which
sets the flag) for local UI/curl work; plain `npm run server` is the fail-closed
entry. Handy for testing scoping without the UI:

```bash
# start backend with the dev header flag
EK_DEV_HEADERS=1 PORT=3010 node --env-file-if-exists=.env server/index.mjs &
curl -s -H "X-User-Email: anna@hwk-hannover.de" -H "X-Device-Id: x" \
  http://localhost:3010/api/data/objekte        # → only demo-1, demo-2
curl -s -H "X-User-Email: max@hwk-hannover.de" -H "X-Device-Id: x" \
  http://localhost:3010/api/data/objekte        # → all objekte
# without EK_DEV_HEADERS the same call returns 401 (no session)
```

## Run — human path

```bash
npm run dev            # Vite on http://localhost:5173 (Ctrl-C to stop)
npm run dev:api        # backend on :3001 WITH X-User-Email trust (role switcher)
# (use `npm run server` instead for the fail-closed backend — no header trust)
```

Open `http://localhost:5173/` in a browser. In dev a **role switcher**
(floating chips: User / Admin / Buchhaltung / Bereichsltg. / GF / Sales)
lets you impersonate roles — this only works against `npm run dev:api`
(the role switcher sends `X-User-Email`, which plain `npm run server`
ignores). Headless, this path shows nothing — use the driver.

## Test / lint

```bash
npm run lint           # eslint
```

(There is no unit-test suite; the driver's `smoke` is the behavioral check.)

## Gotchas

- **Single-shot screenshots race hydration.** Chrome `--screenshot` captures
  on load, before React renders from the Zustand-persist store. The driver
  sleeps 1.5 s before shooting in `e2e`; for the `screenshot` subcommand
  against a fresh page, screenshot a second time if the first is blank.
- **The frontend renders without the backend.** State hydrates from
  `localStorage` (Zustand persist) + seed data, so the UI looks alive even if
  `:3001` is down — but sync, AI, and server-enforced scoping won't work.
  Always start the backend too when testing data flows.
- **`X-User-Email` only works in dev.** With `NODE_ENV=production` the header
  is ignored and every `/api/data` request without a valid session cookie is
  401'd — curl-based identity spoofing is a dev convenience, not a prod hole.
- **Backend port collisions.** `npm run server` hard-codes `PORT` from env
  (default 3001). A stale backend blocks restart with `EADDRINUSE`; kill it:
  `lsof -ti:3001 | xargs kill`. The driver's `e2e`/`smoke` honor `API_PORT`.
- **`server/data/*.json` is real state.** It's gitignored and auto-seeded, but
  the backend persists writes. If a test mutates it, the next run sees the
  change. Reseed by deleting the files and restarting the backend.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Chrome/Chromium found` | `export CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` (or your chromium path) |
| `EADDRINUSE` on `:3001`/`:5173` | `lsof -ti:3001 \| xargs kill` (or `:5173`); or run the driver with `API_PORT=`/`FRONT_PORT=` set |
| `vite did not come up` | run `npm install` first; check the port isn't held by another Vite |
| Screenshot is blank/white | hydration race — see Gotchas; re-run `screenshot`, or use `e2e` which waits |
| AI endpoints 500 / "AI configured: false" | add `ANTHROPIC_API_KEY=…` to a local `.env` (never commit) |

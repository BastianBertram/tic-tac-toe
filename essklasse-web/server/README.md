# EssKlasse AI proxy

A tiny zero-dependency Node server that holds the Anthropic API key
**server-side** and proxies the app's AI calls. The browser never sees the key.

## Why

The frontend used to call `api.anthropic.com` directly with
`anthropic-dangerous-direct-browser-access` and a key read from
`localStorage` / a `VITE_` env var. Any user could read that key from
DevTools, and a `VITE_` var gets baked into the production bundle. An
Anthropic key is a billing credential, so this proxy moves it off the client.

The endpoints are **purpose-built** (prompts are constructed on the server from
structured input), so they can't be abused as an open relay for arbitrary
prompts against your Anthropic account.

## Run

```bash
cp .env.example .env        # then set ANTHROPIC_API_KEY
npm run server              # starts http://localhost:3001
npm run dev                 # Vite frontend in a second terminal
```

`npm run server` uses Node's built-in `--env-file`, so no dotenv dependency is
needed (Node 20.6+; the repo is on 25.x).

## Endpoints

| Method | Path                   | Body                              | Returns                       |
| ------ | ---------------------- | --------------------------------- | ----------------------------- |
| GET    | `/health`              | —                                 | `{ ok, aiConfigured }`        |
| GET    | `/api/settings`        | —                                 | `{ themeId, customColor, logoDataUrl, impressum }` |
| PUT    | `/api/settings`        | full settings object              | persisted settings (admin-only in prod) |
| POST   | `/api/ai/ocr-beleg`    | `{ dataUrl }`                     | `{ data: ExtractedBeleg }`    |
| POST   | `/api/ai/ocr-abschluss`| `{ dataUrl, positionen[] }`       | `{ data: [...] }`             |
| POST   | `/api/ai/duplikat`     | `{ beleg, candidates[] }`         | `{ ids: string[] }`           |
| POST   | `/auth/login`          | `{ email }`                       | `{ ok, devLink? }` (always 200) |
| POST   | `/auth/verify`         | `{ token }`                       | `{ accessToken, user, objekte }` + sets cookie |
| POST   | `/auth/refresh`        | — (refresh cookie)                | `{ accessToken, user, objekte }` |
| POST   | `/auth/logout`         | — (refresh cookie)                | `{ ok }` + clears cookie      |

When `ANTHROPIC_API_KEY` is unset the AI endpoints return `503 AI_NOT_CONFIGURED`
and the frontend falls back to manual entry.

## App settings (branding & Impressum)

`server/settings.mjs` persists the app-wide branding (theme/mood, logo) and
Impressum to `server/data/settings.json` (gitignored), so the values apply to
**all** users and survive restarts. `GET /api/settings` is public (theme/logo are
needed app-wide before login); `PUT /api/settings` is **admin-only in production**
(gated on the session cookie's user role). In dev (`NODE_ENV !== production`) the
PUT is open so the role switcher works without a real login — same dev-grade
posture as the auth scaffold. Swap the JSON file for a real DB before shipping.

## Auth (magic link) — SCAFFOLD

`server/auth.mjs` implements passwordless magic-link login the frontend already
speaks. It is **dev-grade**: in-memory user/token/session stores and no real
email — the login link is logged to the server console and (in non-production)
returned as `devLink` in the `/auth/login` response.

Dev flow:
1. `POST /auth/login { email }` with a known demo email
   (`anna@hwk-hannover.de`, `buchhaltung@hwk-hannover.de`, `max@hwk-hannover.de`).
2. Open the `devLink` (or copy it from the server log). It points at
   `${ALLOWED_ORIGIN}/?token=…`; `AuthGuard` calls `/auth/verify`, stores the
   session, and strips the token from the URL.
3. Subsequent loads call `/auth/refresh` using the `HttpOnly` cookie.

Note: in DEV mode (`import.meta.env.DEV`) `AuthGuard` still auto-logs in as a
demo user, so to exercise the real flow run a production build (`npm run
build && npm run preview`) or temporarily remove that dev shortcut.

Before production, replace the in-memory stores with a DB, plug in a real email
provider, issue a signed JWT access token that protected routes verify, and set
`NODE_ENV=production` (switches the cookie to `SameSite=None; Secure`, which
requires HTTPS).

## Env

| Var                 | Default                  | Notes                                  |
| ------------------- | ------------------------ | -------------------------------------- |
| `ANTHROPIC_API_KEY` | —                        | Required for AI. Never use a `VITE_` name. |
| `PORT`              | `3001`                   | Frontend `VITE_API_URL` must match.    |
| `ALLOWED_ORIGIN`    | `http://localhost:5173`  | CORS origin + magic-link base.         |
| `NODE_ENV`          | —                        | `production` hardens cookies / hides `devLink`. |

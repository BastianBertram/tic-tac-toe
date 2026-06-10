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

| Method | Path                   | Body                              | Returns                  |
| ------ | ---------------------- | --------------------------------- | ------------------------ |
| GET    | `/health`              | —                                 | `{ ok, aiConfigured }`   |
| POST   | `/api/ai/ocr-beleg`    | `{ dataUrl }`                     | `{ data: ExtractedBeleg }` |
| POST   | `/api/ai/ocr-abschluss`| `{ dataUrl, positionen[] }`       | `{ data: [...] }`        |
| POST   | `/api/ai/duplikat`     | `{ beleg, candidates[] }`         | `{ ids: string[] }`      |

When `ANTHROPIC_API_KEY` is unset the AI endpoints return `503 AI_NOT_CONFIGURED`
and the frontend falls back to manual entry.

## Env

| Var                 | Default                  | Notes                                  |
| ------------------- | ------------------------ | -------------------------------------- |
| `ANTHROPIC_API_KEY` | —                        | Required for AI. Never use a `VITE_` name. |
| `PORT`              | `3001`                   | Frontend `VITE_API_URL` must match.    |
| `ALLOWED_ORIGIN`    | `http://localhost:5173`  | CORS origin for the browser.           |

## Note on auth

The frontend also calls `/auth/login` and `/auth/refresh` (magic-link auth).
Those are a separate concern and are **not** implemented here yet — the app
degrades to demo mode when they 404. Add them to this server when wiring up real
authentication.

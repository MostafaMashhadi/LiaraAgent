# Liara Helper Agent

[![Go Version](https://img.shields.io/badge/Go-1.23%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![React & Vite](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%208%20%7C%20Tailwind%204-61DAFB?style=flat&logo=react)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![AvalAI Compatible](https://img.shields.io/badge/Gateway-AvalAI%20%7C%20OpenAI%20%7C%20Gemini-emerald?style=flat)](https://avalai.ir)
[![Liara Cloud](https://img.shields.io/badge/Deploy-Liara%20Cloud-blue?style=flat)](https://liara.ir)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An agentic RAG assistant built for **[Liara Cloud](https://liara.ir)**. It answers questions from official docs, diagnoses deployment failures, generates `liara.json` / `Dockerfile` configs (with optional Vim editing), stores chats and usage in PostgreSQL, and ships with JWT auth, multi-tier rate limiting, and an admin panel for live temperature and token-cost controls.

---

## Features

### Hybrid RAG over Liara docs
- Smart MDX parsing of official Liara docs: strips React tags and keeps tables, code blocks, and callouts (`Step`, `Important`, `Alert`).
- Hybrid search: dense vector similarity plus BM25-style keyword matching (strong for Persian queries).
- Zero-token heuristics: greetings and small talk answered from cache without calling the LLM.

### Universal LLM gateway
- First-class support for **AvalAI** (`https://api.avalai.ir/v1`) as an OpenAI-compatible gateway.
- Works with any OpenAI-compatible chat/embedding endpoint (OpenAI, Gemini via compatible proxies, DeepSeek, Qwen, Llama, Claude via gateways, etc.).
- Streaming over WebSocket and SSE.

### Admin dashboard & RBAC
- Token usage logs in PostgreSQL: prompt tokens, completion tokens, latency, user id, endpoint.
- Live temperature slider (0.0–1.0) without restarting the server.
- Custom USD-per-1M-token rates with estimated cost in USD (and IRR display in the UI).
- One-click rate presets for common AvalAI / OpenAI / Gemini pricing.

### Config Studio (with Vim mode)
- Generates `liara.json` and `Dockerfile` for common stacks (Node.js, Python, Laravel, Django, Next.js, Go, Docker, and more).
- Editor modes:
  - **Normal** — plain text editing with line numbers.
  - **Vim** — motions and operators (`i`, `a`, `o`, `O`, `h`/`j`/`k`/`l`, `0`, `$`, `gg`, `G`, `x`, `dd`, `yy`, `p`, `u`) plus ex commands (`:w`, `:q`, `:wq`, `:format`, `:help`).

### Rate limiting
- Separate budgets for general traffic (~60 RPM) and AI / WebSocket calls (~20 RPM).
- Tracks both authenticated users and IPs; returns `HTTP 429` when exceeded.
- Admin accounts can bypass limits.

### Persistence
- Users with JWT auth and bcrypt password hashes.
- Chat sessions and messages with titles and optional summaries.
- Admin settings and LLM transaction logs.

### Frontend (pnpm workspace)
- React 19 + Vite 8 + Tailwind 4 TypeScript app under `frontend/apps/web`.
- Shared UI kit in `frontend/packages/ui` (`@workspace/ui`).
- Tabs: Chat, Config Studio, Log Debugger, Docs Explorer, Stats, Admin.
- Light/dark theme, header doc search, session sidebar.

---

## Architecture

```mermaid
flowchart TD
    User["Web UI or CLI"]

    subgraph Security ["Security layer"]
        direction TB
        Recovery["Recovery middleware"] --> Logger["Structured logger (slog)"]
        Logger --> JWTAuth["JWT auth & RBAC"]
        JWTAuth --> RateLimiter["Multi-tier rate limiter"]
    end

    User --> Security

    subgraph Backend ["Go API server (:8080)"]
        Router{"HTTP router"}
        Cache["LRU cache (zero-token replies)"]
        AgentCore["Agent coordinator"]
        ConfigEngine["Config Studio"]
        LogAnalyzer["Log diagnostics"]
    end

    RateLimiter --> Router
    Router --> Cache
    Cache -->|"miss"| AgentCore
    Router --> ConfigEngine
    Router --> LogAnalyzer

    subgraph Gateway ["LLM gateways"]
        AvalAI["AvalAI"]
        OpenAI["OpenAI-compatible APIs"]
        Gemini["Gemini (via compatible base URL)"]
    end

    AgentCore --> Gateway

    subgraph Storage ["Storage"]
        Postgres[("PostgreSQL")]
        VectorStore["Hybrid vector / memory store"]
    end

    Backend <--> Postgres
    AgentCore <--> VectorStore
```

**Request path (high level):** middleware (recovery → logging → auth → rate limit) → route handlers → agent / tools → LLM gateway and/or vector store → PostgreSQL for sessions and usage.

---

## Tech stack

| Layer | Stack |
| --- | --- |
| API | Go 1.23+, `net/http`, WebSocket, JWT (`golang-jwt`), `lib/pq`, `bcrypt` |
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS 4, pnpm workspace |
| UI kit | `@workspace/ui` (Base UI primitives + shared styles) |
| Database | PostgreSQL 16 |
| LLM | AvalAI / any OpenAI-compatible chat + embeddings API |
| Deploy | Multi-stage `Dockerfile`, `docker-compose.yml`, `liara.json` |

---

## Project structure

```text
liara-helper-agent/
├── cmd/
│   ├── api/                 # HTTP + WebSocket server entrypoint
│   └── cli/                 # Local RAG CLI for testing
├── frontend/                # pnpm workspace
│   ├── apps/
│   │   └── web/             # Main UI (React 19 + Vite 8 + Tailwind 4)
│   │       ├── src/
│   │       │   ├── components/
│   │       │   │   ├── admin/      # Admin dashboard
│   │       │   │   ├── auth/       # Login / register modal
│   │       │   │   ├── chat/       # Streaming chat view
│   │       │   │   ├── config/     # Config Studio + Vim editor
│   │       │   │   ├── docs/       # Docs explorer
│   │       │   │   ├── layout/     # Shell, sidebar, header search, theme
│   │       │   │   ├── logs/       # Log debugger
│   │       │   │   └── stats/      # Usage stats
│   │       │   ├── lib/
│   │       │   └── types.ts
│   │       ├── package.json
│   │       └── vite.config.ts      # Builds into ../../web/dist
│   ├── packages/
│   │   └── ui/              # Shared components (@workspace/ui)
│   ├── package.json
│   ├── pnpm-workspace.yaml
│   └── .npmrc               # Install native binaries for current OS/CPU only
├── internal/
│   ├── agent/               # Agent coordinator, sessions, tools
│   │   └── tools/           # Config generation + log diagnosis
│   ├── auth/                # JWT, RBAC
│   ├── cache/               # LRU cache
│   ├── config/              # Env / .env loading
│   ├── database/            # PostgreSQL, migrations, usage logs
│   ├── middleware/          # Rate limit, logger, security, recovery
│   ├── parser/              # MDX parser + chunking
│   ├── rag/                 # RAG engine + prompts
│   ├── store/               # Vector / hybrid search store
│   ├── sync/                # Docs sync (GitHub webhook)
│   └── ws/                  # WebSocket chat streaming
├── pkg/
│   └── llm/                 # Chat + embedding client
├── web/
│   ├── dist/                # Vite production output (gitignored)
│   ├── fallback/            # Embedded UI when dist is missing
│   └── web.go
├── data/
│   └── docs/                # Official Liara docs content
├── docker-compose.yml
├── Dockerfile               # Frontend (pnpm) → Go → Alpine runtime
├── liara.json
├── .env.example
└── README.md
```

---

## Prerequisites

- [Go 1.23+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/) and [pnpm](https://pnpm.io/) (`corepack enable` or `npm i -g pnpm`)
- [PostgreSQL](https://www.postgresql.org/) **or** [Docker](https://www.docker.com/) / Docker Compose
- An LLM API key (AvalAI recommended in Iran; OpenAI or any compatible gateway also works)

---

## Configuration

Copy the example env file and edit secrets:

```bash
cp .env.example .env
```

Example (AvalAI):

```env
PORT=8080

DATABASE_URL=postgres://liara:liarapass@localhost:5432/liaradb?sslmode=disable

ADMIN_EMAIL=admin@liara.ir
ADMIN_PASSWORD=Admin@Liara2026!
JWT_SECRET=change-me-to-a-long-random-string

LLM_BASE_URL=https://api.avalai.ir/v1
LLM_API_KEY=aa-your_avalai_api_key_here
LLM_CHAT_MODEL=gpt-4o-mini
LLM_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536

DOCS_DIR=data/docs/src/pages
INDEX_PATH=data/index.json
REPO_DIR=data/docs

RATE_LIMIT_RPM=60

# Optional: GitHub webhook secret for docs sync
# WEBHOOK_SECRET=
```

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP listen port (default `8080`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin user (created on first start) |
| `JWT_SECRET` | Signing secret for auth tokens |
| `LLM_BASE_URL` | OpenAI-compatible API base URL |
| `LLM_API_KEY` | API key for chat + embeddings |
| `LLM_CHAT_MODEL` | Chat model id |
| `LLM_EMBEDDING_MODEL` | Embedding model id |
| `EMBEDDING_DIM` | Vector size (must match the embedding model) |
| `DOCS_DIR` | Path to parsed doc pages |
| `INDEX_PATH` | On-disk index cache path |
| `RATE_LIMIT_RPM` | General requests-per-minute budget |
| `WEBHOOK_SECRET` | Optional shared secret for `/api/webhook/*` |

---

## Quick start

### Option A — Docker Compose (simplest)

Builds the frontend, Go binaries, and starts PostgreSQL + the app:

```bash
cp .env.example .env
# Set LLM_API_KEY (and other secrets) in .env

docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080).

Default admin (change in production):

- Email: `admin@liara.ir`
- Password: `Admin@Liara2026!`

### Option B — Local development

**1. Database**

Start PostgreSQL (Compose DB only is fine):

```bash
docker compose up -d postgres
```

**2. Frontend**

Production build (output → `web/dist`, served by Go):

```bash
cd frontend
pnpm install
pnpm build
cd ..
```

Or run the Vite dev server (proxies `/api` and `/ws` to `:8080`):

```bash
cd frontend
pnpm install
pnpm dev
```

**3. Backend**

```bash
go run ./cmd/api
```

- App (with built UI): [http://localhost:8080](http://localhost:8080)
- Vite HMR (if using `pnpm dev`): [http://localhost:5173](http://localhost:5173)

**4. CLI (optional)**

```bash
go run ./cmd/cli
```

Useful for exercising RAG locally without the web UI.

---

## Frontend workspace commands

Run from `frontend/`:

| Command | Description |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm dev` | Start `apps/web` Vite dev server on `:5173` |
| `pnpm build` | Typecheck + production build → `web/dist` |
| `pnpm lint` | ESLint across packages |
| `pnpm typecheck` | TypeScript checks |
| `pnpm format` | Prettier |

Native packages (Rolldown, etc.) install only for the **current** OS/CPU via `supportedArchitectures` in `frontend/package.json`, which keeps `node_modules` much smaller than a multi-platform install.

To add UI primitives with the shadcn CLI (dev-only, not a runtime dependency):

```bash
cd frontend
pnpm dlx shadcn@latest add button -c packages/ui
```

---

## Tests

```bash
go test -v ./...
```

Covers packages such as auth, middleware/rate limit, parser, RAG prompts, store, cache, sync, WebSocket helpers, and agent tools.

---

## API reference

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/healthz` | Public | Liveness |
| `GET` | `/readyz` | Public | Readiness (includes DB) |
| `POST` | `/api/auth/register` | Public | Register user |
| `POST` | `/api/auth/login` | Public | Login → JWT |
| `GET` | `/api/auth/me` | Auth | Current user |
| `POST` | `/api/chat` | AI rate limit | Chat (SSE stream supported) |
| `WS` | `/ws/chat` | AI rate limit | Bidirectional streaming chat |
| `GET` | `/api/chat/sessions` | User | List sessions |
| `GET` | `/api/chat/messages?session_id=` | User | Messages for a session |
| `GET` | `/api/stats` | Public / user | Aggregate usage stats |
| `POST` | `/api/tools/config` | Public | Generate platform config |
| `POST` | `/api/tools/diagnose` | AI rate limit | Analyze deploy / runtime logs |
| `GET` | `/api/docs/search?q=&category=` | Public | Search indexed docs |
| `GET` | `/api/docs/categories` | Public | Doc categories |
| `GET` | `/api/admin/stats` | Admin | Token usage & cost estimates |
| `GET` | `/api/admin/logs` | Admin | LLM transaction log |
| `GET` / `POST` | `/api/admin/settings` | Admin | Temperature & token rates |
| `POST` | `/api/webhook/github` | Secret | Docs sync webhook |
| `POST` | `/api/webhook/sync` | Secret | Manual / alternate sync trigger |

Send authenticated requests with:

```http
Authorization: Bearer <jwt>
```

---

## Deploy to Liara Cloud

The repo includes a multi-stage `Dockerfile` and `liara.json` (`platform: docker`, port `8080`, persistent disk mounted at `/app/data`). The bundled documentation is intentionally served from `/app/docs`, outside that disk; `/app/data` persists only the generated vector index.

```bash
npm install -g @liara/cli
liara login
liara deploy
```

Set the same environment variables in the Liara app settings (at least `DATABASE_URL`, `JWT_SECRET`, `LLM_API_KEY`, and admin credentials). Attach a PostgreSQL database and point `DATABASE_URL` at it.

---

## Docker image stages

1. **frontend-builder** — Node 20 + pnpm; builds `apps/web` into `/app/web/dist`
2. **builder** — Go toolchain; compiles `cmd/api` and `cmd/cli`
3. **runtime** — Alpine; runs the API server and serves `web/dist` (with `web/fallback` if needed)

Health check: `GET /healthz`.

---

## License

Released under the [MIT License](LICENSE).

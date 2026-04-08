# Trakt Dashboard

A self-hosted TV progress tracker that pulls your watch history from [Trakt](https://trakt.tv) and enriches it with metadata from TMDB and TVDB. Built as a fast, dark-themed dashboard showing episode progress, season breakdowns, and watch statistics.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · Vite 8 · Tailwind v4 · Framer Motion · TanStack Query |
| Backend | Bun · Hono · BullMQ |
| Database | PostgreSQL 16 · Drizzle ORM |
| Queue | Redis 7 |
| Proxy | Nginx |
| Container | Docker Compose |

## Prerequisites

- Docker & Docker Compose v2
- A [Trakt](https://trakt.tv) account (free)
- A [TMDB](https://www.themoviedb.org/settings/api) API key (free)
- Optionally a [TVDB](https://thetvdb.com/dashboard/account/apikey) API key

## Quick Start

### 1. Clone and configure

```bash
git clone <repo>
cd trakt-dashboard
cp .env.example .env
```

### 2. Create a Trakt OAuth application

1. Go to https://trakt.tv/oauth/applications/new
2. Set **Redirect URI** to `http://localhost/auth/callback`  
   (or your server's domain: `https://yourdomain.com/auth/callback`)
3. Copy **Client ID** and **Client Secret** into `.env`

### 3. Get a TMDB API key

1. Go to https://www.themoviedb.org/settings/api
2. Create a free API key
3. Copy it into `.env` as `TMDB_API_KEY`

### 4. Fill in `.env`

```env
TRAKT_CLIENT_ID=your_client_id_here
TRAKT_CLIENT_SECRET=your_client_secret_here
TRAKT_REDIRECT_URI=http://localhost/auth/callback
TMDB_API_KEY=your_tmdb_key_here
API_SECRET=a_random_32_char_string_for_jwt
```

### 5. Launch

```bash
docker compose up -d
```

Open http://localhost and connect your Trakt account. The first full sync will start automatically — expect 5–20 minutes depending on how many shows you've watched.

## Development

```bash
# Install dependencies
pnpm install

# Copy env
cp .env.example .env
# (fill in real API keys)

# Start postgres + redis locally
docker compose up postgres redis -d

# Run DB migrations
cd packages/db && pnpm db:migrate

# Start API + web in watch mode
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/health

## Project Structure

```
trakt-dashboard/
├── apps/
│   ├── api/                    # Bun + Hono backend
│   │   ├── src/
│   │   │   ├── index.ts        # App entry point
│   │   │   ├── routes/         # auth · shows · sync · stats
│   │   │   ├── services/       # trakt · tmdb · sync engine
│   │   │   ├── jobs/           # BullMQ scheduler
│   │   │   └── middleware/     # JWT auth
│   │   └── Dockerfile
│   └── web/                    # React 19 frontend
│       ├── src/
│       │   ├── pages/          # Progress · ShowDetail · Stats · Login
│       │   ├── components/     # Layout · ShowCard · ProgressBar
│       │   ├── hooks/          # TanStack Query hooks
│       │   └── lib/            # api client · utils
│       └── Dockerfile
└── packages/
    ├── types/                  # Shared TypeScript types
    └── db/                     # Drizzle schema + migrations
```

## How Syncing Works

**First login** — triggers a full sync:
1. Fetches all watched shows from Trakt (`/sync/watched/shows`)
2. For each show, pulls detailed progress (which episodes were watched)
3. Fetches show/season/episode metadata from TMDB (with 7-day cache)
4. Writes everything to PostgreSQL
5. Calculates per-show progress summaries

**Incremental sync** — runs every 15 minutes (configurable via `SYNC_INTERVAL_MINUTES`):
1. Fetches only new history entries since last sync
2. Updates affected shows' progress summaries

**Manual sync** — click "Sync now" in the sidebar or `POST /api/sync/trigger`.

## API Reference

```
GET  /health                   → Health check
GET  /auth/trakt               → Start Trakt OAuth
GET  /auth/callback            → OAuth callback
GET  /auth/me                  → Current auth status
POST /auth/logout              → Clear session

GET  /api/shows/progress       → All shows with progress (?filter=watching|completed|all&q=search)
GET  /api/shows/:id            → Single show with full season/episode detail
GET  /api/shows/:id/seasons    → Season list only

GET  /api/sync/status          → Current sync state
POST /api/sync/trigger         → Queue incremental sync
POST /api/sync/full            → Start full re-sync

GET  /api/stats/overview       → Watch stats, monthly chart, top genres
```

## Deployment (VPS / Self-hosted)

Update `.env`:

```env
TRAKT_REDIRECT_URI=https://yourdomain.com/auth/callback
FRONTEND_URL=https://yourdomain.com
API_SECRET=<strong random string>
```

Then:

```bash
docker compose pull
docker compose up -d
```

For HTTPS, put Nginx or Caddy in front of port 80. Example Caddy:

```
yourdomain.com {
  reverse_proxy localhost:80
}
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TRAKT_CLIENT_ID` | ✅ | — | Trakt OAuth app client ID |
| `TRAKT_CLIENT_SECRET` | ✅ | — | Trakt OAuth app client secret |
| `TRAKT_REDIRECT_URI` | ✅ | — | Must match Trakt app settings |
| `TMDB_API_KEY` | ✅ | — | TMDB v3 API key |
| `TVDB_API_KEY` | — | — | TVDB API key (optional) |
| `API_SECRET` | ✅ | — | JWT signing secret (32+ chars) |
| `POSTGRES_USER` | — | `trakt` | DB username |
| `POSTGRES_PASSWORD` | — | `trakt` | DB password (change in prod!) |
| `POSTGRES_DB` | — | `trakt_dashboard` | Database name |
| `SYNC_INTERVAL_MINUTES` | — | `15` | Auto-sync frequency |
| `FRONTEND_URL` | — | `http://localhost` | Used for CORS and OAuth redirect |

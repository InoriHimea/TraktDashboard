# Trakt Dashboard — Requirements

Living spec of the current functional and non-functional requirements. Last reviewed: 2026-06-12.

## Product

A self-hosted TV-show and movie progress tracker powered by Trakt + TMDB. Single-user oriented,
privacy-first (data stays on the user's server).

## Functional requirements

- **Auth** — Trakt OAuth login; session cookie + JWT; logout.
- **Shows** — list with progress (filter watching/completed/all, search); show detail with
  season/episode breakdown; episode detail; reset-show progress (reset cursor).
- **Movies** — watched movie library with rewatch counts and last-watched dates; movie detail.
- **Watchlist** — two-way sync with Trakt (Trakt is source of truth on periodic reconcile).
- **Calendar** — upcoming/recent episodes within a bounded window (≤90 days each direction),
  grouped by air date, showing watched status.
- **Stats** — monthly watch charts, top genres, totals (episodes/movies/runtime).
- **Sync** — initial full sync; scheduled incremental sync (episodes + movies + watchlist);
  manual trigger; status + diagnostics (`/sync/status`, `/sync/health`).
- **Settings** — display language, sync interval, HTTP proxy.
- **i18n** — bilingual UI (zh-CN / en-US) + multilingual TMDB content resolution.

## Non-functional requirements

- **Reliability** — per-user sync mutex; OAuth refresh concurrency-safe; provider HTTP retry
  with backoff + Retry-After; per-provider rate limiting; queue health → 503 (no fake success).
- **Correctness** — reset cursor applied consistently to count / next-episode / lastWatchedAt;
  null-safe timestamp serialization; required `userId` for episode creation.
- **Performance** — stale-while-revalidate metadata cache with per-source TTLs; next-episode via
  `NOT EXISTS` anti-join; route-split web bundles.
- **Security** — self-hosted; DB/Redis bound to loopback; nginx security headers + CSP
  (report-only); secrets via env.
- **Quality gates** — CI runs lint (eslint + prettier) + typecheck + build + coverage tests;
  coverage floors enforced.

## Constraints

- Runtime: Bun (API runs TypeScript source, no build step); React 19 + Vite (web).
- Workspace packages (`types`, `db`, `i18n`) are source-resolved and workspace-internal.
- Deployment: Docker Compose (postgres, redis/keydb, api, web/nginx).
- Versioning: fixed root version, all packages aligned (SemVer; patch for fixes, minor for features).

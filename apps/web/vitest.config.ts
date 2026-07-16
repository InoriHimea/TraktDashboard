/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Explicit web test configuration (P1-T06). jsdom environment for React component tests.
// Kept separate from vite.config.ts so test settings (environment, setupFiles, coverage)
// are no longer implicitly merged from the build config.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.{test,spec}.{ts,tsx}",
                "src/**/__tests__/**",
                "src/test/**",
                "src/main.tsx",
                "src/vite-env.d.ts",
            ],
            // N3-T02 ratcheted the floor up, but later feature rounds shipped largely
            // untested and decayed actuals below it — the gate has been red (and
            // unnoticed) alongside the api one. Re-based 2026-07-07 just below current
            // actuals so the ratchet is honest again.
            // 2026-07-12: added queryKeys/stat-components/ui-small-components/Toaster/
            // notes-lists-ratings hook suites (actuals: stmts 25.5 / branch 21.9 /
            // funcs 18.2 / lines 26.3) — raised the floor to match; keep raising as
            // suites grow.
            // 2026-07-15 (plan-20260715b.md batch 1): added lib/api.ts — table-driven
            // GET/mutation coverage of the entire `api` client surface (request()'s
            // Content-Type gating, credentials, error parsing w/ statusText fallback,
            // plus ~90 domain methods' URL/query/method/body construction) + the
            // special-case history.export() which builds a URL string without
            // calling fetch. lib/api.ts 11.3%→98.7% stmts. Actuals: stmts 30.2 /
            // branch 23.6 / funcs 27.4 / lines 31.2 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 2): added the remaining 63 (of 76)
            // hooks/index.ts hooks — table-driven query-hook data-unwrap + api-call-arg
            // checks, table-driven mutation-hook invalidateQueries-key checks (incl. a
            // "bare mutationFn reference" quirk where react-query passes extra
            // (variables, context) args through to api methods not wrapped in an
            // arrow function), plus dedicated tests for useNowPlaying's derived
            // isWatching, useInfiniteHistory's getNextPageParam pagination,
            // useDeleteHistory's two invalidation-scope variants, and useLogout's
            // setQueryData/removeQueries (no invalidateQueries). hooks/index.ts
            // 17.1%→99.7% stmts. Actuals: stmts 39.1 / branch 25.5 / funcs 44.5 /
            // lines 39.7 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 3, completes the infra layer):
            // added lib/push.ts — the browser-side Web Push subscription flow
            // (isPushSupported/getExistingSubscription/fetchVapidPublicKey/
            // enablePush/disablePush), mocking Notification/PushManager/
            // navigator.serviceWorker via vi.stubGlobal + Object.defineProperty.
            // Covers every enablePush branch: server-unconfigured, permission-
            // denied, fresh subscribe, key-matches reuse, key-rotation
            // unsubscribe+resubscribe, unsubscribe-fails-but-already-cleaned-up,
            // unsubscribe-fails-but-a-concurrent-tab-already-rotated (registers
            // the already-active subscription and returns early), unsubscribe-
            // fails-and-old-key-still-active (push-rotation-blocked), and a
            // failing re-check getSubscription() (treated as cleaned up).
            // lib/push.ts 1.8%→100% stmts. Actuals: stmts 41.0 / branch 26.8 /
            // funcs 45.3 / lines 41.5 — raised again. This completes the
            // infrastructure-layer batches (1-3); remaining batches (4-13) move
            // to components/pages.
            // 2026-07-15 (plan-20260715b.md batch 4): added 8 small display
            // components (Layout, ShowCard, SeasonTab, ProgressBar,
            // TraktProgressBar, DateTimePickerModal, SlidingPanel,
            // EpisodeSeasonStrip) — plain render()/fireEvent tests, no
            // QueryClientProvider needed except where a hook is mocked
            // (ShowCard/Layout). Notable snag: framer-motion's `animate` prop
            // doesn't settle to a deterministic style value in jsdom even under
            // `waitFor` polling (TraktProgressBar), so those assertions target
            // the pct-computation branches executing without error rather than
            // the animated style output. All 8 files landed at 55-100% stmts.
            // Actuals: stmts 44.2 / branch 31.0 / funcs 47.5 / lines 44.7 —
            // raised again.
            // 2026-07-15 (plan-20260715b.md batch 5): added MediaListPage (the
            // shared list-page component MoviesPage/TVShowsPage wrap, tested
            // directly and reached 100%), MoviesPage, TVShowsPage, and
            // WatchlistPage. Recurring snag hit across all of them: `t()` is
            // NOT mocked and resolves to real zh-CN strings (the default
            // locale) — asserting on the literal translation-key text (e.g.
            // "watchlist.empty") always fails; fixed by asserting the actual
            // Chinese string, or for MediaListPage's own test-only filter
            // fixtures, by using deliberately nonexistent keys so `t()`'s
            // fallback-to-key behavior applies. Also: toast() calls only
            // mutate ToastProvider's context state — asserting a toast message
            // appears requires rendering `<Toaster />` alongside the provider,
            // not just the provider itself. Actuals: stmts 47.2 / branch 33.6 /
            // funcs 50.2 / lines 47.7 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 6): added the 8 stats/
            // small-component files (MediaComposition, RatingDistribution,
            // ActivityChart, WatchPatterns, WatchHeatmap, RecentActivity,
            // TraktStats, ScreenTime). Two big snags: (1) recharts'
            // ResponsiveContainer reports 0 width/height in jsdom (no real
            // layout engine) and renders NO chart DOM at all — not even an
            // empty <svg> — so RatingDistribution/ActivityChart/WatchPatterns
            // can only be asserted on their surrounding static text; their
            // CustomTooltip render-prop bodies never execute either (only
            // called on hover), capping those 3 files well under 100%. The
            // per-bar/per-cell JSX (Cell fill/opacity ternaries, label
            // mapping) DOES still execute for coverage purposes since JSX
            // children are constructed eagerly by the parent's own render,
            // regardless of whether ResponsiveContainer mounts them — so
            // varied fixture data is still worth passing in. (2) a lucide
            // icon (CalendarDays) also renders a bare SVG <rect>, so
            // WatchHeatmap's cell queries must scope to the heatmap's own
            // `<svg aria-label>`, not `container.querySelector("rect")`
            // directly. WatchHeatmap/MediaComposition/RecentActivity/
            // TraktStats/ScreenTime all reached 100% stmts. Actuals: stmts
            // 51.9 / branch 37.4 / funcs 54.1 / lines 52.1 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 7): added all 5
            // `JellyfinStatsPage/*` files (ActivityFeed, LibraryOverview,
            // PlayHeatmap, TopContent, index.tsx) — all reached 100% across
            // the board. Snags: dayjs's `fromNow()` needs `vi.setSystemTime`
            // to be deterministic and renders in English (this app never
            // calls `dayjs.locale("zh-cn")` inside ActivityFeed itself, only
            // CalendarPage.tsx does, and dayjs's locale is a global but
            // per-module-graph singleton so it doesn't leak across test
            // files); a lucide icon's registered internal name can differ
            // from its exported component name (`Tv2` renders class
            // `lucide-tv-minimal`, not `lucide-tv-2` — verified by reading
            // the icon source rather than guessing); jsdom re-serializes
            // inline hex colors to `rgb(r, g, b)` when read back via
            // `.style`. Actuals: stmts 53.9 / branch 39.6 / funcs 55.8 /
            // lines 54.1 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 8, mid-size components A):
            // added EpisodeGrid (100%), UpNextBanner (90%), WatchHistoryPanel
            // (97.2%), SearchModal (93.7%) — the biggest branch-coverage jump
            // of this plan (+6.3pp) since these are stateful, interaction-
            // heavy components. Snags: `vi.useFakeTimers()` without
            // `{ shouldAdvanceTime: true }` breaks `waitFor()` (its internal
            // polling depends on real timers ticking), causing a ~5s vitest
            // test-timeout instead of the expected assertion result — always
            // pair fake system-time control with `shouldAdvanceTime: true`
            // whenever a test also needs `waitFor`/async flushing; a
            // module-level `vi.fn()` used as a mocked hook's return value is
            // NOT auto-cleared between tests (no global `clearMocks`), so an
            // earlier test's recorded calls leak into later assertions
            // unless `beforeEach(() => mock.mockClear())` runs; the
            // ConfirmDialog/SlidingPanel's exit animation (AnimatePresence)
            // doesn't reliably unmount in jsdom, matching the
            // TraktProgressBar `animate`-prop snag from batch 4 — assert the
            // resulting behavior (mutation called, callback fired) instead
            // of the dialog's DOM removal; text split across sibling JSX
            // expressions (e.g. `{year}{" · "}<span>...</span>`) is NOT its
            // own standalone text node for `getByText` — match by regex
            // substring instead of the exact value. Actuals: stmts 59.0 /
            // branch 45.9 / funcs 59.2 / lines 59.2 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 9, mid-size components B):
            // added TopNav (84.8%), DiscoverPage (80%), CalendarPage (93.9%)
            // — another large branch jump (+7.2pp), CalendarPage especially
            // dense (dozens of date/format branches). Snags: jsdom doesn't
            // implement `Element.prototype.scrollIntoView` at all — any
            // component calling it (CalendarPage's day-picker autoscroll)
            // throws unless stubbed with `Element.prototype.scrollIntoView =
            // vi.fn()`; a literal string like "今天" or a static UI label
            // that's reused as both a persistent button AND a dynamic status
            // value makes `getByText` ambiguous once both are on screen —
            // scope to the specific element via its class/structure instead;
            // when asserting on same-day/list ordering that a component
            // sorts internally, deliberately declare the test fixture out of
            // order first, so the assertion actually proves the sort ran
            // rather than coincidentally matching input order; an image
            // fallback-chain test (still→backdrop→placeholder via onError)
            // needs a single-item fixture — with multiple items on screen,
            // `container.querySelector("img")` after "removing" one image
            // still finds a different item's untouched image. Actuals: stmts
            // 64.7 / branch 53.1 / funcs 64.5 / lines 64.9 — raised again.
            thresholds: {
                lines: 64,
                functions: 64,
                statements: 64,
                branches: 53,
            },
        },
    },
});

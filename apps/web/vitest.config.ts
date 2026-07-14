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
            thresholds: {
                lines: 47,
                functions: 50,
                statements: 47,
                branches: 33,
            },
        },
    },
});

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
            // 2026-07-15 (plan-20260715b.md batch 10, large components A):
            // added NowPlayingPopup (93.7%, plus dedicated pure-function
            // tests for its exported computeRemainingMinutes/
            // computeProgressPct/formatSeasonEpisode helpers), EpisodeInfoCard
            // (88.5%, the most dialog-heavy file yet — 4 separate
            // ConfirmDialog instances), LoginPage (100%, mostly static
            // marketing content). Snags: a setInterval callback's setState
            // (NowPlayingPopup's countdown tick) fires outside any React
            // event handler, so advancing fake timers must be wrapped in
            // `act()` or the update never flushes before the next assertion;
            // when a page has several ConfirmDialogs and AnimatePresence
            // leaves closed ones lingering in the DOM (batch 8's snag again),
            // two DIFFERENT dialogs can show the identical confirm-button
            // text (e.g. both "删除") — disambiguate by finding each
            // dialog's own unique title text first, then `within(title
            // .closest(".rounded-2xl")).getByRole(...)` to scope the click to
            // that specific dialog; a `<button>`'s `aria-label` silently
            // overrides its accessible name even when the visible text
            // differs, so `getByRole("button", { name })` can collide with a
            // same-named button elsewhere that has no aria-label override —
            // always check the source for `aria-label` before trusting
            // visible text as the accessible name. Actuals: stmts 70.1 /
            // branch 60.0 / funcs 68.7 / lines 70.5 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 11, large components B):
            // added JellyfinTab (100%, pure presentational — all data comes
            // through props, no hooks of its own), HeroSection (100%),
            // MovieDetailPage (88.5%) — the biggest branch-coverage jump of
            // the whole plan (+9.3pp). Snags: a page-level tab switch backed
            // by `<AnimatePresence mode="wait">` never mounts the second
            // tab's content in jsdom at all (not just a lingering-old-content
            // issue like batch 8/10 — with `mode="wait"` specifically, the
            // NEW child waits for the OLD child's exit animation to finish
            // before mounting, which never happens) — the fix was mocking
            // `framer-motion` wholesale for that test file: a `Proxy` over
            // `motion.*` covering every tag the whole child tree might use
            // (Button uses motion.button, cards use motion.div, etc.) via
            // `createElement(tag, domPropsOnly, children)`, and
            // `AnimatePresence` as a bare passthrough; two sibling elements
            // that both derive their label from the same translation key
            // (e.g. a tab button and its section's own heading reusing
            // `watchHistory.showTitle`) are a recurring ambiguity source —
            // grep the actual translation value rather than assuming a
            // shorter/paraphrased string, since guessing wrong reads as "0
            // matches" (not "multiple matches") and looks like a totally
            // different bug at first. Actuals: stmts 75.9 / branch 69.3 /
            // funcs 73.7 / lines 76.6 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 12, super-large pages A):
            // added ListsPage (100% stmts/funcs/lines, 92.1% branch) and
            // CollectionPage (100% stmts/funcs/lines, 84.15% branch) — the two
            // largest files tackled so far after BackupTab (~2036 combined
            // lines), each with several sub-components (CreateListModal;
            // ModalShell/CollectionMovieModal/CollectionEpisodeModal/
            // CollectionSeasonList/CollectionCard). Snag: a card's hover-only
            // "remove" trigger button (opacity/pointerEvents toggled by
            // React state, not conditional mounting) stays in the DOM even
            // when a modal opens on top of the same grid — `.lucide-x` alone
            // becomes ambiguous once both are on screen (matches a card's
            // remove icon before the modal's own close icon in document
            // order); fix by anchoring to the modal's own unique subtitle
            // text first, then `.closest('[role="presentation"]')`, then
            // `.querySelector` scoped to that element. Remaining branch gaps
            // are almost entirely the same two low-value shapes seen in prior
            // batches: `x ?? fallback`/`x ?? []` defensive-coalescing sides
            // that are unreachable through the already-truthy prop shapes
            // used elsewhere in each render path, and the long
            // resolution/HDR/audio ternary chains in `formatBadge` /
            // `CollectionMovieModal`'s fields table (covered for several
            // representative combinations, not exhaustively — consistent with
            // batch 9-11's precedent of not chasing full combinatorial
            // coverage on non-branching display logic). Actuals: stmts 81.2 /
            // branch 78.2 / funcs 80.3 / lines 82.3 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 13, FINAL batch — web side
            // complete): added `settings/BackupTab.tsx` (1488 lines, the
            // largest single web file) — 98.67% stmts/100% lines/97.56%
            // branch/97.14% funcs, the highest result of any large file this
            // plan. Pure controlled component (~40 props, no hooks besides
            // `useToast`), so no QueryClientProvider needed; mocked
            // `../../../lib/api` wholesale. Snags: WebDAV and S3 cards have no
            // `configured` gate (unlike GDrive/OneDrive) so they're ALWAYS both
            // on screen — their "保存并测试" save button and "••••••••"
            // password/secret-key placeholder are byte-identical strings on
            // both cards, making unscoped queries ambiguous from the very
            // first test; fixed with a `cardFor(headingText)` helper walking
            // two `.parentElement`s up from the "WebDAV"/"S3" heading text to
            // reach that specific card, then querying `within()` it. The
            // restore-confirmation dialog's confirmText reuses the exact same
            // translation key as each file row's own "恢复" button, and the
            // dialog's description sentence contains the filename as a
            // substring — both collide with file-row content once the dialog
            // is open; fixed by anchoring to the dialog's own title text via
            // `.closest(".hud-panel-strong")` (ConfirmDialog's card class)
            // before querying further. The GDrive/OneDrive device-code polling
            // loop is a `setInterval(async () => {...}, ms)` — advancing fake
            // timers with plain `vi.advanceTimersByTime` does not await the
            // interval callback's internal `await api.backup.gdrivePoll(...)`;
            // `await vi.advanceTimersByTimeAsync(ms)` (already established in
            // SearchModal's debounce tests) is required to flush it. When a
            // successful restore/disconnect flips a prop-driven dialog's
            // `isOpen` to false in the same state batch that also clears its
            // `isLoading`, AnimatePresence's jsdom-never-completes-exit
            // behavior freezes the dialog's LAST rendered props (isLoading
            // still true) — asserted the resulting side effect (the
            // full-screen restore-done overlay, which isn't AnimatePresence-
            // gated) instead of the frozen button's disabled state reverting.
            // This is the plan's final batch — all 13 web-side batches are now
            // complete. Actuals: stmts 86.2 / branch 81.3 / funcs 83.1 /
            // lines 87.6 — raised again.
            thresholds: {
                lines: 87,
                functions: 83,
                statements: 86,
                branches: 81,
            },
        },
    },
});

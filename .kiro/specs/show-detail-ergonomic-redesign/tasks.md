# Implementation Plan: Show Detail Ergonomic Redesign

## Overview

Rewrite `ShowDetailPage` and introduce five new components (`TraktProgressBar`, `SeasonTab`,
`EpisodeCard`, `EpisodeGrid`, `HeroSection`) using React + TypeScript + Tailwind CSS v4 +
framer-motion. All existing components (`ProgressBar`, `ShowCard`) are left untouched.

## Tasks

- [x] 1. Install dependencies and scaffold test infrastructure
  - Run `pnpm dlx shadcn@latest add button tabs` inside `apps/web/` if `@radix-ui/react-tabs` is not already wired through shadcn
  - Verify `fast-check` is present in `apps/web/package.json` devDependencies (already listed); install `vitest-fast-check` if not present: `pnpm add -D vitest-fast-check --filter @trakt-dashboard/web`
  - Create the test directories `apps/web/src/components/__tests__/` and `apps/web/src/pages/__tests__/` and `apps/web/src/lib/__tests__/`
  - _Requirements: 6 (testing infrastructure prerequisite)_

- [x] 2. Implement `TraktProgressBar` component
  - Create `apps/web/src/components/TraktProgressBar.tsx`
  - Props: `watched: number`, `total: number`, `className?: string`
  - Track: `bg-neutral-800 rounded-full h-2`; fill: `bg-violet-500 rounded-full`
  - Fill width = `clamp(0, (watched / total) * 100, 100)%`; when `total === 0` fill is `0%`
  - Animate fill width with `framer-motion` `motion.div`: `duration: 0.9, ease: [0.16, 1, 0.3, 1]`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.1 Write property test for TraktProgressBar fill clamp (P1)
    - File: `apps/web/src/components/__tests__/TraktProgressBar.test.tsx`
    - **Property 1: TraktProgressBar fill is clamped percentage**
    - Use `fc.integer()` pairs for `watched`/`total`; assert rendered fill width equals `Math.min(100, Math.max(0, (watched / total) * 100))` when `total > 0`, and `0` when `total === 0`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 1: TraktProgressBar fill is clamped percentage`
    - **Validates: Requirements 6.3**

  - [ ]* 2.2 Write unit tests for TraktProgressBar edge cases
    - `total=0` renders without error and fill is 0%
    - `watched > total` clamps to 100%
    - `watched=0` renders 0% fill
    - _Requirements: 6.3, 6.5_

- [x] 3. Implement `SeasonTab` component
  - Create `apps/web/src/components/SeasonTab.tsx`
  - Props: `season: SeasonProgress`, `showPosterPath: string | null`, `isActive: boolean`, `onClick: () => void`
  - Poster thumbnail: `h-16 w-11 aspect-[3/4] rounded-lg border border-white/10`; use `tmdbImage(showPosterPath, 'w185')`; fallback: `bg-neutral-800` div same dimensions
  - Label: `第 {season.seasonNumber} 季`
  - `CompletionBadge`: render when `season.watchedCount === season.airedCount && season.airedCount > 0`; classes `bg-violet-500 rounded-full h-5 w-5` with `<Check size={12} />`
  - Active state: `border-violet-500 bg-violet-500/10`; inactive: `border-white/10 bg-white/5`
  - Minimum touch target: `min-h-[44px]`
  - _Requirements: 3.2, 3.3, 3.4, 3.6, 8.4, 10.2_

  - [ ]* 3.1 Write property test for season tab label format (P3)
    - File: `apps/web/src/components/__tests__/SeasonTab.test.tsx`
    - **Property 3: Season tab label format**
    - Use `fc.nat()` for `seasonNumber`; assert rendered label equals `` `第 ${seasonNumber} 季` ``
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 3: Season tab label format`
    - **Validates: Requirements 3.2, 8.4**

  - [ ]* 3.2 Write property test for CompletionBadge visibility (P4)
    - **Property 4: CompletionBadge visibility**
    - Use `fc.record({ watchedCount: fc.nat(), airedCount: fc.nat() })`; assert badge visible iff `watchedCount === airedCount && airedCount > 0`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 4: CompletionBadge visibility`
    - **Validates: Requirements 3.4**

  - [ ]* 3.3 Write unit tests for SeasonTab
    - Poster fallback renders when `showPosterPath` is null
    - Active vs inactive CSS classes applied correctly
    - `onClick` fires when tab is clicked
    - _Requirements: 3.3, 3.6_

- [x] 4. Implement `EpisodeCard` component
  - Create `apps/web/src/components/EpisodeCard.tsx`
  - Props: `episode: EpisodeProgress`, `index: number`, `seasonNumber: number`
  - Container classes: `bg-black/50 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-row gap-5 items-start hover:bg-black/80 transition-all duration-300 relative`
  - Still image: always render `Tv2` placeholder (`aspect-video bg-neutral-800 rounded-xl` with centered `Tv2` icon) — `EpisodeProgress` has no `stillPath`
  - Context label: `` `S${String(seasonNumber).padStart(2,'0')}E${String(episode.episodeNumber).padStart(2,'0')}` `` in `text-xs text-neutral-500`
  - Title: `text-xl font-extrabold text-white line-clamp-2`; display `episode.title` when non-null, else fallback string (e.g. `第 ${episode.episodeNumber} 集`)
  - Synopsis: omit (no `overview` field on `EpisodeProgress`)
  - `TraktProgressBar`: `watched={episode.watched ? 1 : 0} total={1}`
  - Unaired state: wrap with `opacity-[0.55]` and render `未播出` badge when `episode.aired === false`
  - `WatchCountIndicator`: derive `watchCount = episode.watched ? 1 : 0`; render `× N` only when `watchCount > 1` (currently never, but wired for future data enrichment)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 7.1, 7.3, 8.3, 8.5, 10.3_

  - [ ]* 4.1 Write property test for episode context string format (P6)
    - File: `apps/web/src/components/__tests__/EpisodeCard.test.tsx`
    - **Property 6: Episode context string format**
    - Use `fc.nat()` pairs for `seasonNumber`/`episodeNumber`; assert context label equals `` `S${String(S).padStart(2,'0')}E${String(E).padStart(2,'0')}` ``
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 6: Episode context string format`
    - **Validates: Requirements 5.3, 8.5**

  - [ ]* 4.2 Write property test for episode title display (P7)
    - **Property 7: Episode title display**
    - Use `fc.option(fc.string())` for `title`; assert non-null title is displayed as primary text; null title shows fallback
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 7: Episode title display`
    - **Validates: Requirements 5.4, 8.3**

  - [ ]* 4.3 Write property test for watched state → progress bar fill (P8)
    - **Property 8: Episode watched state determines progress bar fill**
    - Use `fc.record({ watched: fc.boolean(), aired: fc.boolean() })`; assert `watched=true` → `TraktProgressBar` receives `watched=1, total=1`; `watched=false && aired=true` → `watched=0, total=1`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 8: Episode watched state determines progress bar fill`
    - **Validates: Requirements 5.7, 5.8**

  - [ ]* 4.4 Write property test for unaired card state (P9)
    - **Property 9: Unaired episode card state**
    - Use `fc.record({ aired: fc.constant(false), watched: fc.constant(false), ... })`; assert opacity ≤ 0.6 and `未播出` text present
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 9: Unaired episode card state`
    - **Validates: Requirements 5.9**

  - [ ]* 4.5 Write property test for watch-count indicator visibility (P10)
    - **Property 10: Watch-count indicator visibility**
    - Use `fc.nat()` for `watchCount`; assert indicator visible iff `watchCount > 1`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 10: Watch-count indicator visibility`
    - **Validates: Requirements 7.1, 7.3**

  - [ ]* 4.6 Write unit tests for EpisodeCard
    - Tv2 placeholder always rendered (no stillPath)
    - Keyboard focus produces visible focus ring
    - _Requirements: 5.2, 10.3_

- [x] 5. Implement `EpisodeGrid` component
  - Create `apps/web/src/components/EpisodeGrid.tsx`
  - Props: `episodes: EpisodeProgress[]`, `seasonNumber: number`
  - CSS: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8`
  - Wrap in `<AnimatePresence mode="wait">` keyed on `seasonNumber`
  - Entrance `motion.div`: `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}`
  - Render one `EpisodeCard` per entry in `episodes`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 3.7_

  - [ ]* 5.1 Write property test for EpisodeCard count (P5)
    - File: `apps/web/src/components/__tests__/EpisodeGrid.test.tsx`
    - **Property 5: EpisodeCard count matches episodes array**
    - Use `fc.array(episodeProgressArb)` for `episodes`; assert rendered card count equals `episodes.length`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 5: EpisodeCard count matches episodes array`
    - **Validates: Requirements 4.5**

  - [ ]* 5.2 Write unit tests for EpisodeGrid responsive layout
    - Single-column below `md`, two-column between `md`/`xl`, three-column at `xl`+
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Implement `HeroSection` component
  - Create `apps/web/src/components/HeroSection.tsx`
  - Props: `progress: ShowProgress`
  - Root: `relative w-full`; backdrop `absolute inset-0 h-[340px]` img with gradient overlay; omit `<img>` when `backdropPath` is null (show `bg-neutral-950` only)
  - Content row: `relative z-10 flex gap-8 px-0 pt-6 pb-8 items-start`
  - Poster: `w-[200px] min-w-[200px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl`; fallback `bg-neutral-800` div + centered `Tv2` icon
  - Use `resolveTitle(show)` for primary/secondary title display
  - Meta row: year from `show.firstAired`, `show.totalEpisodes`, `show.network`, status badge
  - Overall progress: `<TraktProgressBar watched={watchedEpisodes} total={airedEpisodes} />`
  - Last-watched: `上次观看：{fmtDateZh(lastWatchedAt)}`
  - External link badges: TMDB iff `show.tmdbId`, TVDB iff `show.tvdbId`, IMDB iff `show.imdbId`, Trakt iff `show.traktSlug`
  - Show overview paragraph
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 8.2_

  - [ ]* 6.1 Write property test for show title resolution (P11)
    - File: `apps/web/src/components/__tests__/HeroSection.test.tsx`
    - **Property 11: Show title resolution**
    - Use `fc.record({ translatedName: fc.option(fc.string()), displayLanguage: fc.option(fc.string()), title: fc.string(), originalName: fc.option(fc.string()) })`; assert `translatedName` shown as primary when non-null and `displayLanguage === 'zh-CN'`, else `show.title`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 11: Show title resolution`
    - **Validates: Requirements 8.2**

  - [ ]* 6.2 Write property test for hero metadata completeness (P12)
    - **Property 12: Hero section contains all required show metadata**
    - Use `fc.record(showProgressArb)`; assert rendered output contains primary title, year, totalEpisodes, network, and status badge
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 12: Hero section contains all required show metadata`
    - **Validates: Requirements 9.3**

  - [ ]* 6.3 Write property test for external link badge presence (P14)
    - **Property 14: External link badges appear iff IDs present**
    - Use `fc.record({ tmdbId: fc.option(fc.nat()), tvdbId: fc.option(fc.nat()), imdbId: fc.option(fc.string()), traktSlug: fc.option(fc.string()) })`; assert each badge visible iff corresponding ID is non-null
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 14: External link badges appear iff IDs present`
    - **Validates: Requirements 9.6**

  - [ ]* 6.4 Write unit tests for HeroSection
    - Backdrop absent when `backdropPath` is null (no broken `<img>`)
    - Poster fallback renders when `posterPath` is null
    - `onError` handler on poster `<img>` switches to placeholder
    - _Requirements: 9.1, 9.2, 10.4_

- [x] 7. Extract and test utility functions
  - Move `fmtDateZh` and `resolveTitle` into `apps/web/src/lib/utils.ts` (or a co-located `dateUtils.ts`) so they are importable by both `HeroSection` and tests
  - _Requirements: 8.1, 8.2, 9.5_

  - [ ]* 7.1 Write property test for `fmtDateZh` output (P13)
    - File: `apps/web/src/lib/__tests__/utils.test.ts`
    - **Property 13: Last-watched date zh-CN relative format**
    - Use `fc.option(fc.date())` for `lastWatchedAt`; assert output is a non-empty string; null input returns `从未`; output never contains ASCII-only date patterns
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 13: Last-watched date zh-CN relative format`
    - **Validates: Requirements 9.5**

  - [ ]* 7.2 Write unit tests for `resolveTitle`
    - `translatedName` non-null + `displayLanguage === 'zh-CN'` → primary is `translatedName`
    - `translatedName` null → primary is `show.title`
    - `displayLanguage !== 'zh-CN'` → primary is `show.title`
    - _Requirements: 8.2_

- [x] 8. Checkpoint — Ensure all component tests pass
  - Run `pnpm test --filter @trakt-dashboard/web` and confirm all tests pass; resolve any failures before proceeding.

- [x] 9. Rewrite `ShowDetailPage`
  - Rewrite `apps/web/src/pages/ShowDetailPage.tsx` to compose the new components
  - Root wrapper: `w-full min-h-screen bg-neutral-950 text-white relative z-0 p-10`
  - Inner container: `max-w-[1920px] mx-auto w-full`
  - `BackButton`: `<Button variant="outline" size="lg">` with `ArrowLeft` icon, label `返回`, classes `h-12 w-auto px-6 gap-3 text-lg rounded-xl`, `onClick={() => navigate(-1)}`
  - Render `<HeroSection progress={progress} />`
  - Season tab list using shadcn `<Tabs>` (or equivalent); one `<SeasonTab>` per `progress.seasons` entry; pass `showPosterPath={show.posterPath}`
  - `activeSeason` state defaults to `progress.seasons[0]?.seasonNumber`
  - Render `<EpisodeGrid>` for the active season wrapped in `<AnimatePresence>`
  - Loading state: centered spinner; empty state: `未找到该剧集。`
  - Remove old `EpisodeCard`, `EpisodeListRow`, `EpisodeDialog`, `EpisodeDetail` inline components and view-mode toggle
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.5, 3.7_

  - [ ]* 9.1 Write property test for season tab count (P2)
    - File: `apps/web/src/pages/__tests__/ShowDetailPage.test.tsx`
    - **Property 2: Season tab count matches seasons array**
    - Use `fc.array(fc.record({ seasonNumber: fc.nat(1, 20), ... }))` for `seasons`; assert rendered `SeasonTab` count equals `seasons.length`
    - Tag: `// Feature: show-detail-ergonomic-redesign, Property 2: Season tab count matches seasons array`
    - **Validates: Requirements 3.1**

  - [ ]* 9.2 Write unit tests for ShowDetailPage
    - Clicking a `SeasonTab` updates active season and renders correct `EpisodeGrid`
    - `BackButton` click calls `navigate(-1)`
    - Loading spinner shown while `isLoading` is true
    - Empty state shown when `data` is undefined
    - _Requirements: 2.4, 3.5, 1.1_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Run `pnpm test --filter @trakt-dashboard/web` and confirm all tests pass; ask the user if any questions arise.

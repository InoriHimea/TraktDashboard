# Design Document: Show Detail Ergonomic Redesign

## Overview

This redesign replaces the existing `ShowDetailPage` with a data-rich, dark-mode media dashboard
optimised for wide-screen displays. The primary goals are:

- Full-viewport-width layout with a hard cap at 1920 px
- Strict visual hierarchy using Tailwind CSS v4 utility classes and CSS variable theming
- Trakt-style violet progress bars (`TraktProgressBar`) replacing the existing multi-segment `ProgressBar`
- Season tabs with poster thumbnails and completion badges
- Horizontal `EpisodeCard` components in a responsive 1/2/3-column grid
- Simplified Chinese (zh-CN) labels throughout
- Graceful fallbacks for missing TMDB images (`stillPath` absent from `EpisodeProgress`, `posterPath` absent from `SeasonProgress`)
- Framer-motion fade transitions on season switching

The existing `ProgressBar` component is **not deleted**; it continues to serve `ShowCard` and
`ProgressPage`. `TraktProgressBar` is a new, purpose-built component.

---

## Architecture

### Component Tree

```
ShowDetailPage
├── BackButton                        (shadcn Button, ArrowLeft icon)
├── HeroSection
│   ├── BackdropImage (or gradient fallback)
│   ├── ShowPoster (or Tv2 placeholder)
│   ├── ShowMetadata
│   │   ├── TitleBlock (primary + secondary title)
│   │   ├── MetaRow (year · episodes · network · status badge)
│   │   ├── TraktProgressBar (overall progress)
│   │   ├── LastWatchedLabel
│   │   └── ExternalLinkBadges (TMDB / TVDB / IMDB / Trakt)
│   └── ShowOverview (synopsis)
├── SeasonTabList                     (shadcn Tabs)
│   └── SeasonTab × N
│       ├── SeasonPosterThumbnail (or placeholder)
│       ├── SeasonLabel (`第 N 季`)
│       └── CompletionBadge? (violet circle + Check icon)
└── EpisodeGrid                       (AnimatePresence fade)
    └── EpisodeCard × M
        ├── EpisodeStillImage (or Tv2 placeholder)
        ├── EpisodeContextLabel (`S0XE0Y`)
        ├── EpisodeTitleBlock
        ├── EpisodeSynopsis
        ├── TraktProgressBar (per-episode)
        └── WatchCountIndicator? (× N when N > 1)
```

### File Layout

All new components live inside `apps/web/src/components/` as named exports. The page file
`apps/web/src/pages/ShowDetailPage.tsx` is rewritten to compose them.

```
apps/web/src/
  components/
    TraktProgressBar.tsx      ← new
    SeasonTab.tsx             ← new
    EpisodeCard.tsx           ← new
    EpisodeGrid.tsx           ← new
    HeroSection.tsx           ← new
    ProgressBar.tsx           ← unchanged (used by ShowCard / ProgressPage)
    ShowCard.tsx              ← unchanged
  pages/
    ShowDetailPage.tsx        ← rewritten
```

### State Management

`ShowDetailPage` owns two pieces of local state:

| State | Type | Default | Purpose |
|---|---|---|---|
| `activeSeason` | `number` | first season number | Which season's episodes are shown |

`useShowDetail(id)` from `hooks/index.ts` provides the `ShowProgress` data via React Query.
No additional hooks are needed.

---

## Components and Interfaces

### TraktProgressBar

```tsx
interface TraktProgressBarProps {
  watched: number   // episodes / units watched
  total: number     // total episodes / units
  className?: string
}
```

- Track: `bg-neutral-800 rounded-full h-2`
- Fill: `bg-violet-500 rounded-full`, width = `clamp(0, (watched/total)*100, 100)%`
- Framer-motion `motion.div` animates width with `duration: 0.9, ease: [0.16, 1, 0.3, 1]`
- When `total === 0`, fill width is `0%` (no division by zero)

### SeasonTab

```tsx
interface SeasonTabProps {
  season: SeasonProgress
  showPosterPath: string | null   // fallback when season poster unavailable
  isActive: boolean
  onClick: () => void
}
```

- Poster thumbnail: `h-16 w-11 aspect-[3/4] rounded-lg border border-white/10`
  - Source: `tmdbImage(showPosterPath, 'w185')` — SeasonProgress has no posterPath, so the
    show-level poster is always used as the thumbnail. This is an intentional design decision
    documented in the Data Models section.
  - Fallback: neutral `bg-neutral-800` div of the same dimensions with no icon (clean placeholder)
- Label: `第 {season.seasonNumber} 季`
- CompletionBadge: rendered when `season.watchedCount === season.airedCount && season.airedCount > 0`
  - `bg-violet-500 rounded-full h-5 w-5` containing `<Check size={12} />`
- Active state: `border-violet-500 bg-violet-500/10` vs inactive `border-white/10 bg-white/5`
- Minimum touch target: `min-h-[44px]`

### EpisodeCard

```tsx
interface EpisodeCardProps {
  episode: EpisodeProgress
  index: number               // for staggered entrance animation
  seasonNumber: number        // for context label
}
```

- Container: `bg-black/50 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-row gap-5 items-start hover:bg-black/80 transition-all duration-300 relative`
- Unaired state: `opacity-[0.55]` wrapper + `未播出` badge
- Still image: always a placeholder (`Tv2` icon centered in `aspect-video bg-neutral-800 rounded-xl`)
  because `EpisodeProgress` has no `stillPath`. See Data Models for the gap analysis.
- Context label: `S{padStart(2)}E{padStart(2)}` in `text-xs text-neutral-500`
- Title: `text-xl font-extrabold text-white line-clamp-2`
- Synopsis: not rendered (EpisodeProgress has no overview field)
- TraktProgressBar: `watched={episode.watched ? 1 : 0} total={1}`
- WatchCountIndicator: rendered when `episode.watchCount > 1` (see Data Models note)

### EpisodeGrid

```tsx
interface EpisodeGridProps {
  episodes: EpisodeProgress[]
  seasonNumber: number
}
```

- CSS: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8`
- Wrapped in `<AnimatePresence mode="wait">` keyed on `seasonNumber`
- Entrance: `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}`

### HeroSection

```tsx
interface HeroSectionProps {
  progress: ShowProgress
}
```

- Root: `relative w-full` containing the backdrop strip and the content row
- Backdrop: `absolute inset-0 h-[340px]` img with gradient overlay; omitted when `backdropPath` is null
- Content row: `relative z-10 flex gap-8 px-0 pt-6 pb-8 items-start`
- Poster: `w-[200px] min-w-[200px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl`
- Overall progress: `<TraktProgressBar watched={watchedEpisodes} total={airedEpisodes} />`

---

## Data Models

### Type Gap Analysis

#### EpisodeProgress — missing `stillPath`

`EpisodeProgress` (from `@trakt-dashboard/types`) does **not** carry a `stillPath` field. The
`stillPath` lives on the `Episode` type, which is only present on `ShowProgress.nextEpisode`.

**Design decision**: `EpisodeCard` always renders the Tv2 placeholder for the still image. No
API change is required for this redesign. A future enhancement could enrich `EpisodeProgress`
with `stillPath` from the joined `Episode` row, but that is out of scope here.

#### SeasonProgress — missing `posterPath`

`SeasonProgress` does **not** carry a `posterPath` field. The `Season` type has `posterPath`,
but the progress aggregate does not include it.

**Design decision**: `SeasonTab` uses `show.posterPath` (passed down from `ShowDetailPage`) as
the thumbnail source for every season tab. This gives a consistent, non-broken visual. A future
enhancement could add `posterPath` to `SeasonProgress` on the API side.

#### EpisodeProgress — missing `watchCount`

Requirement 7 references multiple watch records, but `EpisodeProgress` only has `watched: boolean`
and `watchedAt: string | null`. There is no `watchCount` field.

**Design decision**: `EpisodeCard` derives `watchCount` as `episode.watched ? 1 : 0` for now.
The WatchCountIndicator (`× N`) is rendered only when `watchCount > 1`, so it will never appear
until the type is enriched. The component is wired up and ready; the data gap is documented.

### Key Type Shapes (reference)

```ts
// ShowProgress (from @trakt-dashboard/types)
interface ShowProgress {
  show: Show
  airedEpisodes: number
  watchedEpisodes: number
  nextEpisode: Episode | null
  lastWatchedAt: string | null
  completed: boolean
  percentage: number
  seasons: SeasonProgress[]
}

// SeasonProgress — no posterPath
interface SeasonProgress {
  seasonNumber: number
  episodeCount: number
  watchedCount: number
  airedCount: number
  episodes: EpisodeProgress[]
}

// EpisodeProgress — no stillPath, no watchCount
interface EpisodeProgress {
  episodeId: number
  seasonNumber: number
  episodeNumber: number
  title: string | null
  airDate: string | null
  watched: boolean
  watchedAt: string | null
  aired: boolean
}
```

### Title Resolution Logic

```ts
function resolveTitle(show: Show): { primary: string; secondary: string | null } {
  if (show.translatedName && show.displayLanguage === 'zh-CN')
    return { primary: show.translatedName, secondary: show.originalName ?? show.title }
  return { primary: show.title, secondary: null }
}
```

### zh-CN Relative Date Formatting

```ts
function fmtDateZh(date: string | null): string {
  if (!date) return '从未'
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${diff} 天前`
  if (diff < 30) return `${Math.floor(diff / 7)} 周前`
  if (diff < 365) return `${Math.floor(diff / 30)} 个月前`
  return `${Math.floor(diff / 365)} 年前`
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TraktProgressBar fill is clamped percentage

*For any* `watched` and `total` values passed to `TraktProgressBar`, the rendered fill width
percentage must equal `Math.min(100, Math.max(0, (watched / total) * 100))` when `total > 0`,
and `0` when `total === 0`.

**Validates: Requirements 6.3**

---

### Property 2: Season tab count matches seasons array

*For any* `ShowProgress` with N entries in `seasons`, the rendered `SeasonTabList` must contain
exactly N `SeasonTab` elements.

**Validates: Requirements 3.1**

---

### Property 3: Season tab label format

*For any* `SeasonProgress` with `seasonNumber` N, the corresponding `SeasonTab` must display the
label `第 N 季`.

**Validates: Requirements 3.2, 8.4**

---

### Property 4: CompletionBadge visibility

*For any* `SeasonProgress`, the `CompletionBadge` must be visible if and only if
`watchedCount === airedCount && airedCount > 0`.

**Validates: Requirements 3.4**

---

### Property 5: EpisodeCard count matches episodes array

*For any* `SeasonProgress` with M entries in `episodes`, the rendered `EpisodeGrid` must contain
exactly M `EpisodeCard` elements.

**Validates: Requirements 4.5**

---

### Property 6: Episode context string format

*For any* `EpisodeProgress` with `seasonNumber` S and `episodeNumber` E, the context label
rendered by `EpisodeCard` must equal `S${String(S).padStart(2,'0')}E${String(E).padStart(2,'0')}`.

**Validates: Requirements 5.3, 8.5**

---

### Property 7: Episode title display

*For any* `EpisodeProgress` with a non-null `title`, the `EpisodeCard` must display that title
as the primary title text. When `title` is null, the card must display a fallback string.

**Validates: Requirements 5.4, 8.3**

---

### Property 8: Episode watched state determines progress bar fill

*For any* `EpisodeProgress` where `watched === true`, the `TraktProgressBar` inside `EpisodeCard`
must receive `watched=1, total=1` (100% fill). For any `EpisodeProgress` where `watched === false`
and `aired === true`, it must receive `watched=0, total=1` (0% fill).

**Validates: Requirements 5.7, 5.8**

---

### Property 9: Unaired episode card state

*For any* `EpisodeProgress` where `aired === false`, the `EpisodeCard` must render with an
opacity style value ≤ 0.6 and must contain the text `未播出`.

**Validates: Requirements 5.9**

---

### Property 10: Watch-count indicator visibility

*For any* `EpisodeProgress` with a derived `watchCount`, the watch-count indicator (`× N`) must
be visible if and only if `watchCount > 1`. When `watchCount === 1`, no indicator is rendered.

**Validates: Requirements 7.1, 7.3**

---

### Property 11: Show title resolution

*For any* `Show` where `translatedName` is non-null and `displayLanguage === 'zh-CN'`, the
`HeroSection` must display `translatedName` as the primary title. For any `Show` where
`translatedName` is null or `displayLanguage !== 'zh-CN'`, the primary title must be `show.title`.

**Validates: Requirements 8.2**

---

### Property 12: Hero section contains all required show metadata

*For any* `ShowProgress`, the rendered `HeroSection` must contain: the primary show title, the
year derived from `show.firstAired`, `show.totalEpisodes` count, `show.network`, and a status
badge reflecting `show.status`.

**Validates: Requirements 9.3**

---

### Property 13: Last-watched date zh-CN relative format

*For any* `lastWatchedAt` string, the `fmtDateZh` function must return a non-empty zh-CN string.
When `lastWatchedAt` is null, it must return `从未`. The output must never be an empty string or
an English date string.

**Validates: Requirements 9.5**

---

### Property 14: External link badges appear iff IDs present

*For any* `Show`, an external link badge for TMDB must appear if and only if `show.tmdbId` is
non-null; for TVDB iff `show.tvdbId` is non-null; for IMDB iff `show.imdbId` is non-null; for
Trakt iff `show.traktSlug` is non-null.

**Validates: Requirements 9.6**

---

## Error Handling

### Image Load Failures

All `<img>` elements use an `onError` handler that sets a local `imgError` state flag, causing
the component to render the appropriate placeholder instead. This prevents broken-image icons
from appearing in the layout.

| Image | Placeholder |
|---|---|
| Show backdrop | `bg-neutral-950` (no element rendered) |
| Show poster | `bg-neutral-800` div + centered `Tv2` icon |
| Season tab thumbnail | `bg-neutral-800` div, no icon |
| Episode still | `bg-neutral-800` div + centered `Tv2` icon |

### Loading and Empty States

- While `useShowDetail` is loading: centered spinner (`animate-spin` border div)
- When `data` is undefined after load: centered `未找到该剧集。` message
- When `seasons` array is empty: no `SeasonTabList` or `EpisodeGrid` rendered

### Division by Zero in TraktProgressBar

When `total === 0`, the fill percentage is `0` (no division performed). The track still renders
at full width so the component is always visible.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:

- **Unit tests** cover specific examples, integration points, and edge cases
- **Property tests** verify universal rules across randomly generated inputs

### Property-Based Testing Library

**vitest-fast-check** (`fast-check` + `vitest`) is the chosen PBT library for this TypeScript/Vite
project. Each property test runs a minimum of **100 iterations**.

Tag format for each test:
```
// Feature: show-detail-ergonomic-redesign, Property N: <property_text>
```

### Property Tests

Each correctness property from the design maps to exactly one property-based test:

| Property | Test description | Generator inputs |
|---|---|---|
| P1 | TraktProgressBar fill clamp | `fc.integer()` pairs for watched/total |
| P2 | Season tab count | `fc.array(fc.record({seasonNumber: fc.nat()}))` |
| P3 | Season tab label | `fc.nat()` for seasonNumber |
| P4 | CompletionBadge visibility | `fc.record({watchedCount, airedCount})` |
| P5 | EpisodeCard count | `fc.array(episodeProgressArb)` |
| P6 | Context string format | `fc.nat()` pairs for season/episode numbers |
| P7 | Episode title display | `fc.option(fc.string())` for title |
| P8 | Progress bar fill from watched state | `fc.boolean()` pairs for watched/aired |
| P9 | Unaired card opacity + label | `fc.record({aired: fc.constant(false), ...})` |
| P10 | Watch-count indicator | `fc.nat()` for watchCount |
| P11 | Show title resolution | `fc.record({translatedName, displayLanguage, title})` |
| P12 | Hero metadata completeness | `fc.record(showProgressArb)` |
| P13 | fmtDateZh output | `fc.option(fc.date())` for lastWatchedAt |
| P14 | External link badge presence | `fc.record({tmdbId, tvdbId, imdbId, traktSlug})` |

### Unit Tests

Unit tests focus on:

- **Specific examples**: BackButton renders with `返回` label and `ArrowLeft` icon; clicking calls `navigate(-1)`
- **Edge cases**: `TraktProgressBar` with `total=0` renders without error; backdrop missing renders no `<img>`; season with `airedCount=0` shows no CompletionBadge
- **Integration**: `ShowDetailPage` clicking a `SeasonTab` updates the active season and renders the correct `EpisodeGrid`

### Test File Locations

```
apps/web/src/
  components/
    __tests__/
      TraktProgressBar.test.tsx
      SeasonTab.test.tsx
      EpisodeCard.test.tsx
      EpisodeGrid.test.tsx
      HeroSection.test.tsx
  pages/
    __tests__/
      ShowDetailPage.test.tsx
  lib/
    __tests__/
      utils.test.ts          (fmtDateZh, resolveTitle)
```

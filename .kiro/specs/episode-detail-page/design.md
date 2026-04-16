# Design Document

## Overview

This document describes the technical design for refactoring the **Episode Detail Page** to match the provided HTML layout templates. The page already exists in the codebase (`apps/web/src/pages/EpisodeDetailPage.tsx`) with working data-fetching and business logic, but uses inline `style={}` objects throughout. The goal is to replace all inline styles with Tailwind CSS v4 utility classes, introduce the two-state layout (watched vs unwatched) from the HTML templates, and align the visual design with the design system defined in `apps/web/src/index.css`.

### What Already Exists (Do Not Recreate)

| File | Status |
|------|--------|
| `apps/web/src/pages/EpisodeDetailPage.tsx` | ✅ Exists — refactor styles only |
| `apps/web/src/components/EpisodeInfoCard.tsx` | ✅ Exists — refactor styles + layout |
| `apps/web/src/components/EpisodeSeasonStrip.tsx` | ✅ Exists — refactor styles + add grid mode |
| `apps/web/src/components/WatchActionPanel.tsx` | ✅ Exists — refactor button styles |
| `apps/web/src/components/WatchHistoryPanel.tsx` | ✅ Exists — no changes needed |
| `apps/web/src/components/SlidingPanel.tsx` | ✅ Exists — no changes needed |
| `apps/web/src/components/DateTimePickerModal.tsx` | ✅ Exists — no changes needed |
| `apps/web/src/hooks/index.ts` | ✅ Exists — all hooks implemented |
| `apps/api/src/routes/shows.ts` | ✅ Exists — all API endpoints implemented |
| `packages/types/src/index.ts` | ✅ `EpisodeDetailData`, `EpisodeProgress`, `WatchHistoryEntry` defined |

### Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Styling approach | Tailwind CSS v4 utility classes | Replace all inline `style={}` objects; matches project's `@tailwindcss/vite` setup |
| Icon library | `lucide-react` (already installed) | Project uses `lucide-react@^1.7.0`; no Material Symbols needed |
| Animation | `framer-motion` (already installed) | Already used in `SlidingPanel`, `DateTimePickerModal`, `HeroSection` |
| Episode list layout | Conditional: horizontal scroll (watched) / grid (unwatched) | Matches HTML templates exactly |
| Color tokens | CSS custom properties from `index.css` via `var()` | Project uses `--color-*` tokens, not shadcn semantic tokens |
| Font | Inter (already loaded in `index.css`) | Manrope not loaded; use Inter with weight variants |
| shadcn/ui | Not installed — use existing `Button` + custom components | No `components.json` found; project has custom `ui/Button.tsx` |


## Architecture

### Component Tree

```
EpisodeDetailPage                    (pages/EpisodeDetailPage.tsx)
├── <section> Hero Section
│   ├── Backdrop image (blurred, brightness-40)
│   ├── Hero gradient overlay
│   ├── Back button (floating top-left)
│   └── Hero content grid (lg:grid-cols-12)
│       ├── EpisodeInfoCard [lg:col-span-8]
│       │   ├── Breadcrumb nav
│       │   ├── Titles (translated + episode number)
│       │   ├── Metadata badges (year, runtime, genre, rating)
│       │   ├── External link pills (Trakt, TMDB, IMDB, TVDB)
│       │   ├── Overview text
│       │   └── Action buttons (watched | unwatched state)
│       └── Hero thumbnail [lg:col-span-4, hidden on mobile]
├── <section> Episodes Section
│   └── EpisodeSeasonStrip
│       ├── Section header + optional "VIEW ALL" button
│       └── watched  → horizontal scroll (flex overflow-x-auto)
│           unwatched → responsive grid (grid-cols-1/2/4)
├── WatchActionPanel (SlidingPanel)
├── WatchHistoryPanel (SlidingPanel)
└── Mobile bottom nav bar (md:hidden)
```

### File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/web/src/pages/EpisodeDetailPage.tsx` | **Refactor** | Replace all `style={}` with Tailwind classes; add mobile bottom nav |
| `apps/web/src/components/EpisodeInfoCard.tsx` | **Refactor** | Replace inline styles; implement two-state action buttons per templates |
| `apps/web/src/components/EpisodeSeasonStrip.tsx` | **Refactor** | Replace inline styles; add `watched` prop to switch between scroll/grid layout |
| `apps/web/src/index.css` | **Extend** | Add `hero-gradient` class and custom scrollbar utilities |


## Component Specifications

### 2. EpisodeInfoCard

**File:** `apps/web/src/components/EpisodeInfoCard.tsx`

**Changes:** Replace all inline `style={}` objects with Tailwind utility classes. Implement the two-state action button layout exactly matching the HTML templates. The component props interface and data-fetching logic remain unchanged.

**Watched state — 3 action buttons (h-14 w-48 rounded-xl):**
- Button 1 `bg-purple-600 hover:bg-purple-700` — done_all icon (custom double-check SVG)
- Button 2 `bg-teal-700 hover:bg-teal-800` — Check icon + "Watch again..." label
- Button 3 `bg-slate-700 hover:bg-slate-800` — History icon + "History" label
- Shared: `h-14 w-48 rounded-xl flex items-center justify-center gap-3 shadow-md active:scale-[0.98] transition-all cursor-pointer`

**Unwatched state — 2 action buttons (w-40 py-3.5 rounded-xl):**
- Button 1 `bg-[#F3E8FF] hover:bg-[#E9D5FF] border border-[#D8B4FE]` — Check icon only (text-[#9333EA])
- Button 2 `bg-zinc-800/80 hover:bg-zinc-800 border border-white/10` — History icon + "History" label
- Shared: `w-40 py-3.5 rounded-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all cursor-pointer`

**Metadata badge:** `bg-white/10 px-3 py-1 rounded-lg text-xs font-medium text-white/80 backdrop-blur-sm`

**Rating badge:** `flex items-center gap-1.5 bg-[#6da7ff]/20 px-3 py-1 rounded-lg` with Star icon `text-[#87b4ff] fill-[#87b4ff]`

**External link pill:** `bg-white/5 hover:bg-white/10 transition-all px-4 py-1.5 rounded-full border border-white/5 text-[10px] font-bold tracking-widest uppercase text-white/60`

**Breadcrumb:** `flex items-center gap-2 text-zinc-400 text-xs tracking-widest uppercase` with ChevronRight icons; current segment uses `text-[#ff8aa8]`

**Titles:** Translated title `text-[#f472b6] text-lg font-semibold tracking-wide`; episode number `text-white text-5xl md:text-7xl font-extrabold tracking-tight`

**Overview:** `text-zinc-300 text-base leading-relaxed max-w-2xl`

---

### 3. EpisodeSeasonStrip

**File:** `apps/web/src/components/EpisodeSeasonStrip.tsx`

**Changes:** Add `watched: boolean` prop to switch between horizontal scroll (watched) and responsive grid (unwatched). Replace all inline styles with Tailwind classes.

**Updated props:**
```tsx
interface EpisodeSeasonStripProps {
  episodes: EpisodeProgress[]
  seasonNumber: number
  currentEpisodeNumber: number
  showId: number
  watched: boolean   // NEW — controls layout mode
}
```

**Section header:** `flex items-center justify-between mb-8`
- Title: `text-2xl font-bold tracking-tight flex items-center gap-3 text-white`
- Decorative line: `w-12 h-0.5 bg-white/10`
- "VIEW ALL" button (unwatched only): `text-[#ff8aa8] text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:translate-x-1 transition-transform cursor-pointer`

**Watched layout — horizontal scroll:**
```
flex overflow-x-auto gap-6 pb-6 episode-scrollbar scroll-smooth
```
Each card: `flex-none w-[280px]`

**Unwatched layout — responsive grid:**
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6
```

**EpisodeThumbnail card:**
- Wrapper: `group cursor-pointer` (+ `opacity-50 cursor-default` when unaired)
- Thumbnail container (default): `relative aspect-video rounded-xl overflow-hidden mb-3 bg-zinc-900 border border-white/5 shadow-xl`
- Thumbnail container (current): `relative aspect-video rounded-xl overflow-hidden mb-3 bg-zinc-900 shadow-xl ring-2 ring-[#ff8aa8] ring-offset-4 ring-offset-[#050505]`
- Image: `w-full h-full object-cover group-hover:scale-110 transition-transform duration-500`
- Duration badge: `absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white`
- Current overlay: `absolute inset-0 bg-[#ff8aa8]/10 mix-blend-overlay`
- Title (current): `font-bold text-sm text-[#ff8aa8]`
- Title (default): `font-bold text-sm text-white group-hover:text-[#ff8aa8] transition-colors`
- Episode code: `text-xs text-zinc-500 tracking-wider mt-1`

---

### 4. EpisodeDetailPage

**File:** `apps/web/src/pages/EpisodeDetailPage.tsx`

**Changes:** Replace all `style={}` objects with Tailwind classes. Pass `watched={data.watched}` to `EpisodeSeasonStrip`. Add mobile bottom nav bar.

**Page wrapper:** `min-h-screen pb-24 md:pb-12 bg-[#050505] text-white`

**Hero section:** `relative w-full flex items-end overflow-hidden min-h-[80vh]`

**Background image:** `absolute inset-0 z-0` containing:
- img: `w-full h-full object-cover scale-105 blur-sm brightness-[0.4]`
- gradient overlay: `absolute inset-0 hero-gradient`

**Back button:** `absolute top-6 left-8 z-20 flex items-center gap-1.5 text-xs font-medium text-white/65 bg-white/8 border border-white/12 rounded-lg px-3.5 py-1.5 backdrop-blur-md hover:text-white hover:bg-white/15 transition-all cursor-pointer`

**Hero content grid:** `relative z-10 w-full max-w-7xl mx-auto px-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end`

**Left column:** `lg:col-span-8`

**Right thumbnail (desktop only):**
- Wrapper: `hidden lg:block lg:col-span-4 group relative`
- Inner: `aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]`
- Play overlay: `absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`

**Episodes section:** `max-w-7xl mx-auto px-8 mt-12 mb-20`

**Mobile bottom nav:** `fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-6 pt-3 md:hidden bg-[#050505]/90 backdrop-blur-lg z-50 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,1)] border-t border-white/5`

**Skeleton:** Replace inline styles with `min-h-screen bg-[#050505]`, `h-[80vh] bg-white/5 animate-pulse`, `max-w-7xl mx-auto px-8 mt-12`, `w-full h-56 rounded-2xl bg-white/5 animate-pulse`

---

### 5. CSS Extensions (index.css)

**File:** `apps/web/src/index.css`

Add after the existing global styles:

```css
/* Hero gradient — used by EpisodeDetailPage backdrop */
.hero-gradient {
  background: linear-gradient(
    to bottom,
    rgba(5, 5, 5, 0.2) 0%,
    rgba(5, 5, 5, 0.4) 50%,
    rgba(5, 5, 5, 1) 100%
  );
}

/* Episode horizontal scroll custom scrollbar */
.episode-scrollbar::-webkit-scrollbar { height: 4px; }
.episode-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
.episode-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 138, 168, 0.3);
  border-radius: 10px;
}
.episode-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 138, 168, 0.5);
}
```


## Data Models

No new data models are required. All types are already defined in `packages/types/src/index.ts`:

| Type | Used By | Notes |
|------|---------|-------|
| `EpisodeDetailData` | `EpisodeDetailPage`, `EpisodeInfoCard` | Includes `watched`, `traktRating`, `directors`, `seasonEpisodes` |
| `EpisodeProgress` | `EpisodeSeasonStrip`, `EpisodeThumbnail` | Includes `watched`, `aired`, `stillPath`, `runtime` |
| `WatchHistoryEntry` | `WatchHistoryPanel` | Includes `watchedAt` (nullable) |

The `EpisodeDetailData.watched` boolean field drives the two-state layout:
- `watched === true` → watched layout (purple/teal/slate buttons, horizontal scroll)
- `watched === false` → unwatched layout (light purple/zinc buttons, responsive grid)

## API Design

All API endpoints are already implemented in `apps/api/src/routes/shows.ts`. No new endpoints needed.

| Endpoint | Method | Used By | Status |
|----------|--------|---------|--------|
| `/api/shows/:showId/episodes/:season/:episode` | GET | `useEpisodeDetail` hook | ✅ Implemented |
| `/api/shows/:showId/episodes/:season/:episode/watch` | POST | `useMarkWatched` hook | ✅ Implemented |
| `/api/shows/:showId/episodes/:season/:episode/history` | GET | `useEpisodeHistory` hook | ✅ Implemented |
| `/api/shows/:showId/history` | GET | `useShowHistory` hook | ✅ Implemented |
| `/api/shows/:showId/history/:historyId` | DELETE | `useDeleteHistory` hook | ✅ Implemented |

## State Management

All state management is already implemented via React Query hooks in `apps/web/src/hooks/index.ts`:

| Hook | Purpose | Query Key |
|------|---------|-----------|
| `useEpisodeDetail(showId, season, episode)` | Fetch episode data | `['episode-detail', showId, season, episode]` |
| `useMarkWatched(showId, season, episode)` | POST watch record | Invalidates episode-detail + show-detail |
| `useEpisodeHistory(showId, season, episode)` | Fetch episode history | `['episode-history', showId, season, episode]` |
| `useDeleteHistory(showId, season?, episode?)` | DELETE history record | Invalidates episode-history + show-history |

Local UI state in `EpisodeDetailPage`:
- `watchPanelOpen: boolean` — controls `WatchActionPanel` visibility
- `historyPanelOpen: boolean` — controls `WatchHistoryPanel` visibility

## Correctness Properties

These properties define the formal correctness guarantees for the feature, validated via property-based tests using `fast-check`.

### Property 1: Watch status drives layout

*For any* `EpisodeDetailData` value, if `data.watched === true` then the rendered action buttons MUST include a purple button with done_all icon, a teal "Watch again" button, and a slate "History" button. If `data.watched === false` then the rendered action buttons MUST include a light purple check button and a zinc "History" button.

**Validates:** Requirements 3.1–3.3, 4.1–4.2

### Property 2: Watch status drives episode list layout

*For any* `EpisodeDetailData` value, if `data.watched === true` then `EpisodeSeasonStrip` MUST render a horizontally scrollable container. If `data.watched === false` then it MUST render a CSS grid container.

**Validates:** Requirements 5.1, 6.1

### Property 3: Current episode always highlighted

*For any* list of `EpisodeProgress[]` and any `currentEpisodeNumber`, the card whose `episodeNumber === currentEpisodeNumber` MUST have the `ring-2 ring-[#ff8aa8]` classes applied, and all other cards MUST NOT have those classes.

**Validates:** Requirements 5.4, 6.6

### Property 4: Rating display invariant

*For any* `traktRating` value in range [0, 100], the rendered rating badge MUST display exactly `"{traktRating}%"`. If `traktRating === null`, the rating badge MUST NOT be rendered.

**Validates:** Requirement 1.6

### Property 5: Invalid route params redirect

*For any* combination of `showId`, `season`, `episode` route params where at least one is not a positive integer (including zero, negative, non-numeric), the page MUST redirect to `/progress`.

**Validates:** Requirement 8 (implicit — route guard)

### Property 6: External links open correct URLs

*For any* `EpisodeDetailData` with non-null `traktSlug`, `tmdbId`, `imdbId`, `tvdbId`, the corresponding external link pill MUST render an anchor tag with `target="_blank"` and an `href` containing the correct base URL for that service.

**Validates:** Requirement 2.5

### Property 7: Localized title fallback chain

*For any* `EpisodeDetailData`, the displayed episode title MUST be `translatedTitle` when non-null, otherwise `title` when non-null, otherwise a fallback string like `"S{season}E{episode}"`.

**Validates:** Requirement 1.3–1.4

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid route params (non-integer) | `<Navigate to="/progress" replace />` immediately |
| API loading | `<EpisodeDetailSkeleton />` with `animate-pulse` |
| API error | Error UI with retry button calling `refetch()` |
| Episode not found (404) | "未找到该集" message |
| Still image load failure | `onError` → `<EpisodePlaceholder />` (already in `EpisodeSeasonStrip`) |
| Watch API failure | Inline error in `WatchActionPanel` confirm view |
| Delete history failure | Inline error in `WatchHistoryPanel` |

## Testing Strategy

### Property-Based Tests (fast-check)

Location: `apps/web/src/components/__tests__/`

| Test File | Properties Covered |
|-----------|-------------------|
| `EpisodeInfoCard.property.test.tsx` | Property 1 (action buttons), Property 4 (rating), Property 7 (title fallback) |
| `EpisodeSeasonStrip.property.test.tsx` | Property 2 (layout mode), Property 3 (current highlight) |
| `EpisodeDetailPage.property.test.tsx` | Property 5 (route guard), Property 6 (external links) |

Each property test runs minimum 100 iterations with `fast-check`.

### Unit Tests

| Test | Coverage |
|------|----------|
| `EpisodeInfoCard` — watched state renders 3 buttons | Req 3.1–3.3 |
| `EpisodeInfoCard` — unwatched state renders 2 buttons | Req 4.1–4.2 |
| `EpisodeSeasonStrip` — watched renders horizontal scroll | Req 5.1 |
| `EpisodeSeasonStrip` — unwatched renders grid + VIEW ALL | Req 6.1, 6.4 |
| `EpisodeSeasonStrip` — current episode has ring classes | Req 5.4 |
| `EpisodeDetailPage` — invalid params redirect | Route guard |
| `EpisodeDetailPage` — loading shows skeleton | Loading state |


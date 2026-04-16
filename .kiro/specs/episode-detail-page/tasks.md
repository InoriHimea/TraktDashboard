# Tasks

## Task List

- [x] 1. Add CSS utilities to index.css
  - [x] 1.1 Add `.hero-gradient` class with the bottom-fade gradient
  - [x] 1.2 Add `.episode-scrollbar` custom scrollbar styles for horizontal scroll

- [x] 2. Refactor EpisodeDetailPage.tsx
  - [x] 2.1 Replace all `style={}` objects with Tailwind utility classes
  - [x] 2.2 Pass `watched={data.watched}` prop to `EpisodeSeasonStrip`
  - [x] 2.3 Add mobile bottom navigation bar (`md:hidden`)
  - [x] 2.4 Refactor `EpisodeDetailSkeleton` to use Tailwind classes

- [x] 3. Refactor EpisodeInfoCard.tsx
  - [x] 3.1 Replace all `style={}` objects with Tailwind utility classes
  - [x] 3.2 Implement watched-state action buttons (purple/teal/slate, h-14 w-48)
  - [x] 3.3 Implement unwatched-state action buttons (light purple/zinc, w-40 py-3.5)
  - [x] 3.4 Refactor `MetaBadge`, `RatingBadge`, `ExternalPill` sub-components to use Tailwind
  - [x] 3.5 Refactor breadcrumb, titles, and overview to use Tailwind classes

- [x] 4. Refactor EpisodeSeasonStrip.tsx
  - [x] 4.1 Add `watched: boolean` prop to component interface
  - [x] 4.2 Implement conditional layout: horizontal scroll when watched, grid when unwatched
  - [x] 4.3 Add "VIEW ALL" button in section header (unwatched mode only)
  - [x] 4.4 Replace all `style={}` objects in `EpisodeSeasonStrip` with Tailwind classes
  - [x] 4.5 Replace all `style={}` objects in `EpisodeThumbnail` with Tailwind classes
  - [x] 4.6 Apply `ring-2 ring-[#ff8aa8] ring-offset-4 ring-offset-[#050505]` to current episode card
  - [x] 4.7 Apply `bg-[#ff8aa8]/10 mix-blend-overlay` overlay to current episode thumbnail

- [-] 5. Write property-based tests
  - [x] 5.1 `EpisodeInfoCard.property.test.tsx` — Property 1 (action buttons by watch status), Property 4 (rating display), Property 7 (title fallback chain)
  - [x] 5.2 `EpisodeSeasonStrip.property.test.tsx` — Property 2 (layout mode by watch status), Property 3 (current episode highlight)
  - [ ] 5.3 `EpisodeDetailPage.property.test.tsx` — Property 5 (invalid route params redirect), Property 6 (external link URLs)

# Requirements Document

## Introduction

This feature is an ergonomic wide-screen redesign of the `ShowDetailPage` and its related episode UI
components. The current implementation suffers from layout underutilization on wide displays, invisible
content due to color conflicts, poor ergonomics (small interactive targets, cramped spacing), missing
Chinese (zh-CN) localization, and absent Trakt-style progress indicators. The redesign produces a
data-rich, dark-mode media dashboard that maximizes wide-screen real estate, enforces strict visual
hierarchy, and delivers a premium Trakt-inspired experience.

---

## Glossary

- **ShowDetailPage**: The React page component rendered at `/shows/:id` that displays a single TV
  show's metadata, season list, and episode browser.
- **EpisodeCard**: A horizontal list card component that renders one episode's thumbnail, title,
  synopsis, and progress bar inside the episode grid.
- **SeasonTab**: A clickable tab element representing one season; contains a poster thumbnail, season
  number label (zh-CN), and an optional completion badge.
- **EpisodeGrid**: The responsive CSS grid that contains all `EpisodeCard` components for the active
  season.
- **TraktProgressBar**: A two-layer progress bar with a dark neutral track and a violet fill,
  indicating watch progress for a single episode or season.
- **CompletionBadge**: A small violet circular badge with a checkmark icon displayed on a
  `SeasonTab` when every aired episode in that season has been watched.
- **BackButton**: The large, accessible navigation button that returns the user to the previous page.
- **HeroSection**: The top area of `ShowDetailPage` containing the backdrop image, show poster,
  title, metadata, and overall progress bar.
- **TMDB**: The Movie Database — the external image CDN used for poster and still images.
- **zh-CN**: Simplified Chinese locale used for all user-visible labels and episode titles.

---

## Requirements

### Requirement 1: Root Layout and Dark-Mode Enforcement

**User Story:** As a user on a wide-screen monitor, I want the show detail page to fill the full
viewport width with a consistent dark background, so that I can consume content without wasted space
or eye-straining color conflicts.

#### Acceptance Criteria

1. THE ShowDetailPage SHALL render a root wrapper element with the CSS classes
   `w-full min-h-screen bg-neutral-950 text-white relative z-0 p-10`.
2. THE ShowDetailPage SHALL render an inner container with the CSS classes
   `max-w-[1920px] mx-auto w-full` to constrain content on ultra-wide displays while still
   expanding to fill available space.
3. WHEN the viewport width is less than 1280 px, THE ShowDetailPage SHALL remain fully readable
   with no horizontal overflow or clipped content.
4. IF the show's backdrop image is unavailable, THEN THE ShowDetailPage SHALL display the
   `bg-neutral-950` background without any broken-image artefacts.

---

### Requirement 2: Back Button Ergonomics

**User Story:** As a user navigating between pages, I want a large, clearly visible back button, so
that I can return to the previous page without hunting for a small control.

#### Acceptance Criteria

1. THE BackButton SHALL be rendered using a `shadcn/ui` `<Button variant="outline" size="lg">`
   component.
2. THE BackButton SHALL include a Lucide `ArrowLeft` icon and the zh-CN label `返回`.
3. THE BackButton SHALL apply the CSS classes `h-12 w-auto px-6 gap-3 text-lg rounded-xl` to
   produce a large, easy-to-click target.
4. WHEN the BackButton is clicked, THE ShowDetailPage SHALL navigate to the previous browser
   history entry.
5. THE BackButton SHALL be positioned in the top-left area of the page, above the HeroSection.

---

### Requirement 3: Season Tabs with Poster Thumbnails and Completion Badge

**User Story:** As a user browsing seasons, I want each season tab to show a poster thumbnail and
a completion indicator, so that I can quickly identify which seasons I have finished.

#### Acceptance Criteria

1. THE ShowDetailPage SHALL render one `SeasonTab` per entry in `ShowProgress.seasons`.
2. EACH SeasonTab SHALL display the season number in zh-CN format (e.g., `第 1 季`).
3. EACH SeasonTab SHALL display a poster thumbnail image with the CSS classes
   `h-16 w-11 aspect-[3/4] rounded-lg border border-white/10`; WHEN the season poster is
   unavailable, THE SeasonTab SHALL display a neutral placeholder of the same dimensions.
4. WHEN `SeasonProgress.watchedCount` equals `SeasonProgress.airedCount` AND
   `SeasonProgress.airedCount` is greater than 0, THE SeasonTab SHALL display a
   `CompletionBadge` with the CSS classes `bg-violet-500 rounded-full h-5 w-5` containing a
   Lucide `Check` icon.
5. WHEN a SeasonTab is clicked, THE ShowDetailPage SHALL set that season as the active season and
   render the corresponding EpisodeGrid below the tabs.
6. THE active SeasonTab SHALL be visually distinguished from inactive tabs (e.g., highlighted
   border or background).
7. WHEN the active season changes, THE EpisodeGrid SHALL transition in with a fade animation of
   duration ≤ 300 ms.

---

### Requirement 4: Episode Grid Layout

**User Story:** As a user viewing a season's episodes, I want the episodes displayed in a
responsive wide grid, so that I can scan many episodes at once on large screens without excessive
vertical scrolling.

#### Acceptance Criteria

1. THE EpisodeGrid SHALL apply the CSS classes
   `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8`.
2. WHEN the viewport width is below the `md` breakpoint (768 px), THE EpisodeGrid SHALL render
   a single-column layout.
3. WHEN the viewport width is between the `md` and `xl` breakpoints, THE EpisodeGrid SHALL
   render a two-column layout.
4. WHEN the viewport width is at or above the `xl` breakpoint (1280 px), THE EpisodeGrid SHALL
   render a three-column layout.
5. THE EpisodeGrid SHALL render one `EpisodeCard` per entry in `SeasonProgress.episodes`.

---

### Requirement 5: Episode Card — Structure and Styling

**User Story:** As a user reviewing episodes, I want each episode displayed as a rich horizontal
card with an image, localized title, synopsis, and progress bar, so that I can quickly assess
watch status and episode content.

#### Acceptance Criteria

1. EACH EpisodeCard SHALL be rendered as a horizontal flex container with the CSS classes
   `bg-black/50 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl flex
   flex-row gap-5 items-start hover:bg-black/80 transition-all duration-300 relative`.
2. THE EpisodeCard SHALL display an episode still image on the left side with a 16:9 aspect
   ratio; IF the still image URL is unavailable, THEN THE EpisodeCard SHALL display a
   structured placeholder of the same dimensions containing a centered `Tv2` icon.
3. THE EpisodeCard SHALL display the episode context string (e.g., `S01E03`) in a small muted
   label above the episode title.
4. THE EpisodeCard SHALL display the episode title using the CSS classes
   `text-xl font-extrabold text-white line-clamp-2`; WHEN a zh-CN translated title is
   available in the data, THE EpisodeCard SHALL display the translated title as the primary
   title.
5. THE EpisodeCard SHALL display the episode synopsis/overview using the CSS classes
   `text-sm text-neutral-400 line-clamp-3 leading-relaxed`; WHEN a zh-CN translated overview
   is available, THE EpisodeCard SHALL display the translated overview.
6. THE EpisodeCard SHALL display a `TraktProgressBar` below the synopsis.
7. WHEN `EpisodeProgress.watched` is `true`, THE TraktProgressBar fill SHALL be set to 100%.
8. WHEN `EpisodeProgress.watched` is `false` AND `EpisodeProgress.aired` is `true`, THE
   TraktProgressBar fill SHALL be set to 0% with the track still visible.
9. WHEN `EpisodeProgress.aired` is `false`, THE EpisodeCard SHALL render with reduced opacity
   (≤ 0.6) and display a zh-CN "未播出" label.

---

### Requirement 6: TraktProgressBar Component

**User Story:** As a user, I want a Trakt-style progress bar on each episode card, so that I can
see watch progress at a glance using a familiar visual language.

#### Acceptance Criteria

1. THE TraktProgressBar SHALL render a track element with the CSS classes
   `bg-neutral-800 rounded-full h-2`.
2. THE TraktProgressBar SHALL render a fill element inside the track with the CSS class
   `bg-violet-500 rounded-full`.
3. THE TraktProgressBar fill width SHALL be calculated as `(watchedCount / totalCount) * 100`
   percent, clamped between 0 and 100.
4. WHEN the fill width changes, THE TraktProgressBar SHALL animate the width transition with a
   duration of 900 ms using an ease-out curve.
5. THE TraktProgressBar SHALL accept `watched` (number) and `total` (number) as props and
   derive the fill percentage from those values.

---

### Requirement 7: Multiple Watch Records Display

**User Story:** As a user who has re-watched episodes, I want the episode card to indicate
multiple watch records, so that I can see my full viewing history for that episode.

#### Acceptance Criteria

1. WHEN an episode has been watched more than once (multiple `WatchHistory` entries), THE
   EpisodeCard SHALL display a watch-count indicator (e.g., `× 2`) adjacent to the progress
   bar or watched badge.
2. THE watch-count indicator SHALL use a muted label style that does not compete visually with
   the episode title.
3. WHEN an episode has exactly one watch record, THE EpisodeCard SHALL NOT display the
   watch-count indicator.

---

### Requirement 8: zh-CN Localization

**User Story:** As a Chinese-speaking user, I want all UI labels, season numbers, and episode
metadata displayed in Simplified Chinese, so that the interface is fully comprehensible without
switching languages.

#### Acceptance Criteria

1. THE ShowDetailPage SHALL display all static UI labels in zh-CN (e.g., `返回`, `第 N 季`,
   `已看完`, `未播出`, `上次观看`).
2. WHEN `Show.translatedName` is non-null AND `Show.displayLanguage` is `zh-CN`, THE
   ShowDetailPage SHALL display `Show.translatedName` as the primary show title.
3. WHEN `EpisodeProgress.title` contains a zh-CN translated value, THE EpisodeCard SHALL
   display it as the primary episode title.
4. THE SeasonTab label SHALL follow the pattern `第 N 季` where N is the season number.
5. THE EpisodeCard context string SHALL follow the pattern `S0XE0Y` (numeric, not localized)
   to remain compatible with international episode numbering conventions.

---

### Requirement 9: Hero Section — Show Metadata and Overall Progress

**User Story:** As a user landing on the show detail page, I want to see the show's poster,
backdrop, title, and overall watch progress prominently displayed, so that I can orient myself
before browsing seasons.

#### Acceptance Criteria

1. THE HeroSection SHALL display the show's backdrop image as a full-width background strip
   behind the poster and metadata; IF the backdrop is unavailable, THE HeroSection SHALL
   display a dark gradient fallback.
2. THE HeroSection SHALL display the show poster at a fixed width of 200 px with a 2:3 aspect
   ratio and `rounded-xl` styling.
3. THE HeroSection SHALL display the primary show title, secondary original title (when
   available), year, total episode count, network, and status badge.
4. THE HeroSection SHALL display a `TraktProgressBar` representing overall show progress
   (`watchedEpisodes / airedEpisodes`).
5. THE HeroSection SHALL display the last-watched date in zh-CN relative format (e.g.,
   `3 天前`).
6. THE HeroSection SHALL display external link badges for TMDB, TVDB, IMDB, and Trakt when
   the corresponding IDs are present on the `Show` object.

---

### Requirement 10: Accessibility and Interaction Ergonomics

**User Story:** As a user with motor or visual impairments, I want interactive elements to be
large enough to click accurately and have sufficient color contrast, so that the page is usable
without assistive technology workarounds.

#### Acceptance Criteria

1. THE BackButton SHALL have a minimum touch target height of 48 px (3 rem / `h-12`).
2. EACH SeasonTab SHALL have a minimum touch target height of 44 px.
3. EACH EpisodeCard SHALL respond to keyboard focus with a visible focus ring.
4. WHEN an image fails to load, THE ShowDetailPage SHALL display a meaningful placeholder
   rather than a broken-image icon, ensuring the layout does not collapse.
5. THE ShowDetailPage SHALL not render any text with a contrast ratio below 3:1 against its
   immediate background for non-decorative text elements.

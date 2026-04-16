# Requirements Document

## Introduction

The Episode Detail Page displays comprehensive information about a single TV show episode, including hero section with backdrop imagery, episode metadata, watch status management, and related episodes navigation. The page adapts its layout and action buttons based on whether the episode has been watched or not.

**Technical Stack:**
- React + TypeScript
- shadcn/ui components (Button, Badge, Card, Separator, ScrollArea, etc.)
- Tailwind CSS v4 with `@theme inline` blocks
- Material Symbols Outlined icons
- React Router for dynamic routing

**shadcn/ui Guidelines:**
This feature MUST follow shadcn/ui best practices as defined in `.agents/skills/shadcn/SKILL.md`:
- Use semantic color tokens (`bg-primary`, `text-muted-foreground`) instead of raw color values
- Use `gap-*` for spacing, never `space-x-*` or `space-y-*`
- Use `size-*` when width and height are equal
- Use `cn()` utility for conditional classes
- Use `data-icon` attribute for icons in buttons
- Use proper component composition (Card with CardHeader/CardContent/CardFooter, etc.)
- Use existing shadcn/ui components before creating custom markup
- Follow form patterns with FieldGroup + Field for form layouts
- Ensure all Dialog/Sheet components have required Title elements for accessibility

## Glossary

- **Episode_Detail_Page**: The React component that displays detailed information about a single TV show episode
- **Hero_Section**: The top section containing backdrop image, episode title, metadata, and action buttons
- **Episode_Card**: A shadcn/ui Card component displaying episode thumbnail, title, and metadata
- **Episodes_Section**: The section displaying related episodes from the same season or show
- **Watch_Status**: The state indicating whether an episode has been watched or unwatched
- **Metadata_Badge**: A shadcn/ui Badge component displaying episode information (year, duration, genre, rating)
- **External_Link_Button**: A shadcn/ui Button component that navigates to external services (Trakt, TMDB, IMDB, TVDB)
- **Action_Button**: A shadcn/ui Button component for watch status management (Mark as Watched, Watch Again, History)
- **Breadcrumb_Navigation**: Navigation component showing the hierarchical path (TV Shows > Show Name > Season)
- **Episode_Grid**: A responsive grid layout displaying multiple episode cards
- **Episode_Horizontal_Scroll**: A horizontally scrollable container using shadcn/ui ScrollArea component
- **Backdrop_Image**: The large background image with blur and gradient overlay
- **Hero_Thumbnail**: The episode thumbnail displayed in the hero section on larger screens
- **Rating_Badge**: A shadcn/ui Badge component displaying the episode rating percentage with star icon

## Requirements

### Requirement 1: Hero Section Display

**User Story:** As a user, I want to see a visually rich hero section with episode information, so that I can quickly understand what the episode is about.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL display a Backdrop_Image with blur effect and gradient overlay
2. THE Hero_Section SHALL display breadcrumb navigation showing TV Shows > Show Name > Season hierarchy
3. THE Hero_Section SHALL display the episode title in large typography (5xl on mobile, 7xl on desktop)
4. THE Hero_Section SHALL display the original language title in secondary color above the main title
5. THE Hero_Section SHALL display Metadata_Badges for year, duration, and genre
6. THE Hero_Section SHALL display a Rating_Badge with star icon and percentage
7. THE Hero_Section SHALL display the episode description with maximum width constraint
8. WHERE the viewport width is 1024px or greater, THE Hero_Section SHALL display a Hero_Thumbnail with hover play icon overlay
9. THE Backdrop_Image SHALL use object-cover positioning and scale-105 with brightness reduction to 40%
10. THE Hero_Section SHALL use a gradient overlay transitioning from 20% opacity at top to 100% opacity at bottom

### Requirement 2: External Links Integration

**User Story:** As a user, I want to access external services for more information, so that I can view the episode on different platforms.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL display External_Link_Buttons for Trakt, TMDB, IMDB, and TVDB
2. WHEN a user hovers over an External_Link_Button, THE button SHALL increase background opacity from 5% to 10%
3. THE External_Link_Buttons SHALL use uppercase text with tracking-widest spacing
4. THE External_Link_Buttons SHALL use rounded-full border radius with white/5 border
5. WHEN a user clicks an External_Link_Button, THE Episode_Detail_Page SHALL open the corresponding external service URL in a new tab

### Requirement 3: Watch Status Management for Watched Episodes

**User Story:** As a user who has watched an episode, I want to see appropriate action buttons, so that I can manage my watch history.

#### Acceptance Criteria

1. WHEN the Watch_Status is "watched", THE Episode_Detail_Page SHALL display a purple "Mark All Watched" button with done_all icon
2. WHEN the Watch_Status is "watched", THE Episode_Detail_Page SHALL display a teal "Watch Again" button with check icon
3. WHEN the Watch_Status is "watched", THE Episode_Detail_Page SHALL display a slate "History" button with history icon
4. WHEN a user clicks the "Watch Again" button, THE Episode_Detail_Page SHALL open a date-time picker modal
5. WHEN a user clicks the "History" button, THE Episode_Detail_Page SHALL navigate to the watch history view
6. WHEN a user hovers over an Action_Button, THE button SHALL apply scale-98 transform on active state
7. THE Action_Buttons SHALL have height of 56px (h-14) and width of 192px (w-48)

### Requirement 4: Watch Status Management for Unwatched Episodes

**User Story:** As a user who has not watched an episode, I want to see appropriate action buttons, so that I can mark it as watched.

#### Acceptance Criteria

1. WHEN the Watch_Status is "unwatched", THE Episode_Detail_Page SHALL display a light purple "Mark as Watched" button with check icon
2. WHEN the Watch_Status is "unwatched", THE Episode_Detail_Page SHALL display a dark gray "History" button with history icon
3. WHEN a user clicks the "Mark as Watched" button, THE Episode_Detail_Page SHALL open a date-time picker modal
4. THE "Mark as Watched" button SHALL use bg-[#F3E8FF] background with hover state bg-[#E9D5FF]
5. THE "Mark as Watched" button SHALL use border-[#D8B4FE] border color
6. THE Action_Buttons SHALL have width of 160px (w-40) and padding-y of 14px (py-3.5)

### Requirement 5: Episodes Section for Watched Episodes

**User Story:** As a user viewing a watched episode, I want to see related episodes in a horizontal scroll, so that I can easily navigate to other episodes.

#### Acceptance Criteria

1. WHEN the Watch_Status is "watched", THE Episodes_Section SHALL display Episode_Cards in an Episode_Horizontal_Scroll container
2. THE Episode_Horizontal_Scroll SHALL allow horizontal scrolling with custom scrollbar styling
3. THE Episode_Card SHALL have a fixed width of 280px (w-[280px])
4. WHEN an Episode_Card represents the current episode, THE Episode_Card SHALL display a ring-2 ring-primary border with ring-offset-4
5. WHEN an Episode_Card represents the current episode, THE Episode_Card SHALL apply a primary/10 color overlay
6. THE Episode_Horizontal_Scroll SHALL display a custom scrollbar with height of 4px
7. THE custom scrollbar track SHALL use rgba(255, 255, 255, 0.05) background
8. THE custom scrollbar thumb SHALL use rgba(255, 138, 168, 0.3) background with hover state rgba(255, 138, 168, 0.5)

### Requirement 6: Episodes Section for Unwatched Episodes

**User Story:** As a user viewing an unwatched episode, I want to see related episodes in a grid layout, so that I can view multiple episodes at once.

#### Acceptance Criteria

1. WHEN the Watch_Status is "unwatched", THE Episodes_Section SHALL display Episode_Cards in an Episode_Grid layout
2. THE Episode_Grid SHALL use 1 column on mobile, 2 columns on tablet (sm:grid-cols-2), and 4 columns on desktop (lg:grid-cols-4)
3. THE Episode_Grid SHALL have gap-6 spacing between cards
4. THE Episodes_Section SHALL display a "VIEW ALL" button with arrow_forward icon aligned to the right
5. WHEN a user hovers over the "VIEW ALL" button, THE button SHALL translate 4px to the right (translate-x-1)
6. WHEN an Episode_Card represents the current episode, THE Episode_Card SHALL display a ring-2 ring-primary border with ring-offset-4

### Requirement 7: Episode Card Display

**User Story:** As a user, I want to see episode cards with thumbnails and metadata, so that I can identify and select episodes.

#### Acceptance Criteria

1. THE Episode_Card SHALL display an episode thumbnail with aspect-video ratio
2. THE Episode_Card SHALL display episode duration in bottom-right corner with bg-black/80 backdrop-blur
3. THE Episode_Card SHALL display episode title and season/episode number (S01 · E01 format)
4. WHEN a user hovers over an Episode_Card, THE thumbnail SHALL scale to 110% with transition-transform duration-500
5. WHEN a user hovers over an Episode_Card, THE episode title SHALL change color to primary
6. THE Episode_Card thumbnail SHALL use rounded-xl border radius
7. THE Episode_Card SHALL use cursor-pointer to indicate interactivity
8. WHEN a user clicks an Episode_Card, THE Episode_Detail_Page SHALL navigate to the selected episode

### Requirement 8: Responsive Layout

**User Story:** As a user on different devices, I want the page to adapt to my screen size, so that I have an optimal viewing experience.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL use max-w-7xl container with mx-auto centering
2. THE Episode_Detail_Page SHALL use px-8 horizontal padding on all screen sizes
3. THE Hero_Section SHALL use single column layout on mobile and 12-column grid on desktop (lg:grid-cols-12)
4. THE Hero_Section content SHALL span 8 columns on desktop (lg:col-span-8)
5. THE Hero_Thumbnail SHALL span 4 columns on desktop (lg:col-span-4) and be hidden on mobile
6. THE Episode_Detail_Page SHALL display a bottom navigation bar on mobile (md:hidden)
7. THE bottom navigation bar SHALL use fixed positioning with backdrop-blur-lg and rounded-t-3xl
8. THE Episode_Detail_Page SHALL have pb-24 padding on mobile and pb-12 on desktop to account for bottom navigation

### Requirement 9: Visual Styling and Theme

**User Story:** As a user, I want a visually consistent dark theme interface, so that I have a comfortable viewing experience.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL use the custom color palette defined in Tailwind config
2. THE Episode_Detail_Page SHALL use Manrope font family for headlines and Inter for body text
3. THE Metadata_Badges SHALL use bg-white/10 background with backdrop-blur-sm
4. THE Rating_Badge SHALL use bg-tertiary-container/20 background with tertiary color for icon and text
5. THE Episode_Detail_Page SHALL use #050505 as the primary background color
6. THE Episode_Detail_Page SHALL use #ffffff as the primary text color
7. THE Episode_Detail_Page SHALL use Material Symbols Outlined icon font with font-variation-settings
8. THE Episode_Detail_Page SHALL apply smooth transitions with duration-200 to duration-500 for interactive elements

### Requirement 11: shadcn/ui Component Usage

**User Story:** As a developer, I want to use shadcn/ui components correctly, so that the UI is consistent, accessible, and maintainable.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL use shadcn/ui Button component for all action buttons with appropriate variants
2. THE Episode_Detail_Page SHALL use shadcn/ui Badge component for all metadata badges (year, duration, genre, rating)
3. THE Episode_Card SHALL use shadcn/ui Card component with proper composition (Card > CardContent)
4. THE Episode_Horizontal_Scroll SHALL use shadcn/ui ScrollArea component for custom scrollbar styling
5. THE Episode_Detail_Page SHALL use shadcn/ui Separator component instead of manual border divs
6. THE Episode_Detail_Page SHALL use semantic color tokens (bg-primary, text-muted-foreground) instead of raw Tailwind colors
7. THE Episode_Detail_Page SHALL use `gap-*` utilities for spacing, never `space-x-*` or `space-y-*`
8. THE Episode_Detail_Page SHALL use `size-*` utility when width and height are equal (e.g., icon sizing)
9. THE Episode_Detail_Page SHALL use `cn()` utility function for conditional className composition
10. THE Action_Buttons SHALL use `data-icon` attribute for icon positioning (data-icon="inline-start" or data-icon="inline-end")
11. THE Episode_Detail_Page SHALL NOT apply sizing classes (size-4, w-4, h-4) directly on icons inside shadcn/ui components
12. THE Episode_Detail_Page SHALL use `truncate` shorthand instead of manual overflow-hidden text-ellipsis whitespace-nowrap
13. THE Episode_Detail_Page SHALL NOT use manual `dark:` color overrides, relying on semantic tokens instead
14. THE Episode_Detail_Page SHALL NOT manually set z-index on overlay components (Dialog, Sheet, Popover)
15. WHEN adding new shadcn/ui components, THE developer SHALL run `npx shadcn@latest add <component>` to install them
16. WHEN using icons in buttons, THE developer SHALL pass icon components as objects, not string keys
17. THE Episode_Detail_Page SHALL use proper Card composition with CardHeader, CardContent, and CardFooter where appropriate
18. THE Episode_Detail_Page SHALL ensure all images have proper alt text for accessibility

### Requirement 12: Tailwind CSS v4 Integration

**User Story:** As a developer, I want to use Tailwind CSS v4 features correctly, so that the styling is modern and maintainable.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL use `@theme inline` blocks for custom CSS variables in the global CSS file
2. THE Episode_Detail_Page SHALL reference the project's `tailwindCssFile` from shadcn config for custom styles
3. THE Episode_Detail_Page SHALL use Tailwind v4 syntax for custom properties and theme extensions
4. THE custom scrollbar styles SHALL be defined using `@theme inline` blocks, not in tailwind.config.js
5. THE hero-gradient custom class SHALL be defined in the global CSS file using CSS custom properties
6. THE Episode_Detail_Page SHALL use modern Tailwind v4 utilities for backdrop-blur and backdrop-filter effects
7. THE Episode_Detail_Page SHALL leverage Tailwind v4's improved arbitrary value syntax where needed

### Requirement 10: Accessibility and Interaction

**User Story:** As a user, I want clear visual feedback for interactive elements, so that I know what I can interact with.

#### Acceptance Criteria

1. THE Episode_Detail_Page SHALL use cursor-pointer for all clickable elements
2. THE Episode_Detail_Page SHALL provide hover states for all interactive buttons and cards
3. THE Episode_Detail_Page SHALL use transition-all or transition-colors for smooth state changes
4. THE Episode_Detail_Page SHALL use active:scale-[0.98] for button press feedback
5. THE Episode_Detail_Page SHALL provide alt text for all images (Backdrop_Image, Hero_Thumbnail, Episode_Card thumbnails)
6. THE Episode_Detail_Page SHALL use semantic HTML elements (nav, section, main, button)
7. THE Episode_Detail_Page SHALL ensure sufficient color contrast for text elements (zinc-300 for body text, white for headings)
8. THE Breadcrumb_Navigation SHALL use chevron_right icons to indicate hierarchy
9. THE Episode_Detail_Page SHALL be keyboard navigable with proper focus states
10. THE Episode_Detail_Page SHALL use ARIA attributes where appropriate for screen reader support


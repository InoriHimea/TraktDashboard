// Feature: episode-detail-page
// Property 2: Watch status drives episode list layout
// Property 3: Current episode always highlighted

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { EpisodeSeasonStrip } from '../EpisodeSeasonStrip'
import type { EpisodeProgress } from '@trakt-dashboard/types'

// Mock react-router-dom navigate
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEpisode(overrides: Partial<EpisodeProgress> = {}): EpisodeProgress {
  return {
    episodeId: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    title: 'Test Episode',
    translatedTitle: null,
    overview: null,
    translatedOverview: null,
    airDate: '2024-01-01',
    watched: false,
    watchedAt: null,
    aired: true,
    stillPath: null,
    runtime: 45,
    ...overrides,
  }
}

function makeEpisodes(count: number, seasonNumber = 1): EpisodeProgress[] {
  return Array.from({ length: count }, (_, i) =>
    makeEpisode({ episodeId: i + 1, episodeNumber: i + 1, seasonNumber })
  )
}

// ─── Property 2: Watch status drives episode list layout ─────────────────────
// watched=true → horizontal scroll container (flex overflow-x-auto)
// watched=false → CSS grid container (grid)

describe('Property 2: watch status drives episode list layout', () => {
  it('watched=true renders a horizontal scroll container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 5 }),
        (count, currentEp) => {
          const episodes = makeEpisodes(count)
          const current = Math.min(currentEp, count)
          const { container, unmount } = render(
            <EpisodeSeasonStrip
              episodes={episodes}
              seasonNumber={1}
              currentEpisodeNumber={current}
              showId={1}
              watched={true}
            />
          )
          // Horizontal scroll: has overflow-x-auto class
          const scrollContainer = container.querySelector('.overflow-x-auto')
          expect(scrollContainer).toBeTruthy()
          // No grid container
          const gridContainer = container.querySelector('.grid')
          expect(gridContainer).toBeNull()
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('watched=false renders a CSS grid container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 5 }),
        (count, currentEp) => {
          const episodes = makeEpisodes(count)
          const current = Math.min(currentEp, count)
          const { container, unmount } = render(
            <EpisodeSeasonStrip
              episodes={episodes}
              seasonNumber={1}
              currentEpisodeNumber={current}
              showId={1}
              watched={false}
            />
          )
          // Grid layout: has grid class
          const gridContainer = container.querySelector('.grid')
          expect(gridContainer).toBeTruthy()
          // No horizontal scroll container
          const scrollContainer = container.querySelector('.overflow-x-auto')
          expect(scrollContainer).toBeNull()
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('layout is mutually exclusive: never both scroll and grid', () => {
    fc.assert(
      fc.property(fc.boolean(), (watched) => {
        const episodes = makeEpisodes(4)
        const { container, unmount } = render(
          <EpisodeSeasonStrip
            episodes={episodes}
            seasonNumber={1}
            currentEpisodeNumber={2}
            showId={1}
            watched={watched}
          />
        )
        const hasScroll = !!container.querySelector('.overflow-x-auto')
        const hasGrid = !!container.querySelector('.grid')
        // Exactly one layout is active
        expect(hasScroll).toBe(watched)
        expect(hasGrid).toBe(!watched)
        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it('watched=false shows "VIEW ALL" button; watched=true does not', () => {
    fc.assert(
      fc.property(fc.boolean(), (watched) => {
        const episodes = makeEpisodes(4)
        const { unmount } = render(
          <EpisodeSeasonStrip
            episodes={episodes}
            seasonNumber={1}
            currentEpisodeNumber={1}
            showId={1}
            watched={watched}
          />
        )
        const viewAllBtn = screen.queryByText('VIEW ALL')
        if (watched) {
          expect(viewAllBtn).toBeNull()
        } else {
          expect(viewAllBtn).toBeTruthy()
        }
        unmount()
      }),
      { numRuns: 100 }
    )
  })
})

// ─── Property 3: Current episode always highlighted ───────────────────────────
// The card with episodeNumber === currentEpisodeNumber has ring-[#ff8aa8] classes;
// all other cards do NOT have those classes.

describe('Property 3: current episode always highlighted', () => {
  it('current episode card has ring-[#ff8aa8] class; others do not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.boolean(),
        (count, watched) => {
          const episodes = makeEpisodes(count)
          // Pick a random current episode
          const currentEp = Math.ceil(count / 2)
          const { container, unmount } = render(
            <EpisodeSeasonStrip
              episodes={episodes}
              seasonNumber={1}
              currentEpisodeNumber={currentEp}
              showId={1}
              watched={watched}
            />
          )
          // Find all thumbnail containers (aspect-video divs)
          const thumbnailContainers = container.querySelectorAll('.aspect-video')
          let currentHighlighted = 0
          let othersHighlighted = 0

          thumbnailContainers.forEach((el, idx) => {
            const hasRing = el.className.includes('ring-[#ff8aa8]')
            if (idx === currentEp - 1) {
              if (hasRing) currentHighlighted++
            } else {
              if (hasRing) othersHighlighted++
            }
          })

          expect(currentHighlighted).toBe(1)
          expect(othersHighlighted).toBe(0)
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('current episode card has aria-current="true"; others do not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.boolean(),
        (count, watched) => {
          const episodes = makeEpisodes(count)
          const currentEp = 1 // always first episode
          const { container, unmount } = render(
            <EpisodeSeasonStrip
              episodes={episodes}
              seasonNumber={1}
              currentEpisodeNumber={currentEp}
              showId={1}
              watched={watched}
            />
          )
          const currentCards = container.querySelectorAll('[aria-current="true"]')
          // Exactly one card has aria-current="true"
          expect(currentCards.length).toBe(1)
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('current episode overlay tint is rendered only for current card', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.boolean(),
        (count, watched) => {
          const episodes = makeEpisodes(count)
          const currentEp = 2
          const { container, unmount } = render(
            <EpisodeSeasonStrip
              episodes={episodes}
              seasonNumber={1}
              currentEpisodeNumber={currentEp}
              showId={1}
              watched={watched}
            />
          )
          // The overlay tint has bg-[#ff8aa8]/10 mix-blend-overlay
          const overlays = container.querySelectorAll('.mix-blend-overlay')
          // Exactly one overlay (for the current episode)
          expect(overlays.length).toBe(1)
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })
})

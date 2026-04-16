// Feature: episode-detail-page
// Property 1: Watch status drives action button layout
// Property 4: Rating display invariant
// Property 7: Localized title fallback chain

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import { EpisodeInfoCard } from '../EpisodeInfoCard'
import type { EpisodeDetailData } from '@trakt-dashboard/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<EpisodeDetailData> = {}): EpisodeDetailData {
  return {
    episodeId: 1,
    showId: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    title: 'Test Episode',
    translatedTitle: null,
    overview: 'Test overview',
    translatedOverview: null,
    airDate: '2024-01-01',
    runtime: 45,
    stillPath: null,
    watched: false,
    watchedAt: null,
    traktRating: null,
    directors: [],
    show: {
      id: 1,
      title: 'Test Show',
      posterPath: null,
      genres: ['Drama'],
      traktId: 1,
      traktSlug: 'test-show',
      tmdbId: 100,
      imdbId: 'tt1234567',
      tvdbId: 200,
    },
    seasonEpisodes: [],
    ...overrides,
  }
}

// ─── Property 1: Watch status drives action button layout ─────────────────────
// For any EpisodeDetailData, if watched=true → 3 buttons (purple/teal/slate);
// if watched=false → 2 buttons (light purple/zinc)

describe('Property 1: watch status drives action button layout', () => {
  it('watched=true renders "Watch again..." and "History" buttons (teal + slate)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (showId, episodeNumber) => {
          const data = makeData({ showId, episodeNumber, watched: true })
          const { unmount } = render(
            <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
          )
          // Watched state: teal "Watch again..." button
          expect(screen.getByText('Watch again...')).toBeTruthy()
          // Watched state: slate "History" button
          const historyBtns = screen.getAllByText('History')
          expect(historyBtns.length).toBeGreaterThanOrEqual(1)
          // Watched state: purple done_all button (aria-label="已观看")
          expect(screen.getByLabelText('已观看')).toBeTruthy()
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('watched=false renders "标记为已观看" button and no "Watch again..." button', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (showId, episodeNumber) => {
          const data = makeData({ showId, episodeNumber, watched: false })
          const { unmount } = render(
            <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
          )
          // Unwatched state: light purple check button
          expect(screen.getByLabelText('标记为已观看')).toBeTruthy()
          // Unwatched state: no "Watch again..." button
          expect(screen.queryByText('Watch again...')).toBeNull()
          // Unwatched state: no purple done_all button
          expect(screen.queryByLabelText('已观看')).toBeNull()
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('watched state is mutually exclusive: never shows both button sets', () => {
    fc.assert(
      fc.property(fc.boolean(), (watched) => {
        const data = makeData({ watched })
        const { unmount } = render(
          <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
        )
        const hasWatchedButtons = !!screen.queryByText('Watch again...')
        const hasUnwatchedButton = !!screen.queryByLabelText('标记为已观看')
        // Exactly one set of buttons is shown, never both
        expect(hasWatchedButtons).toBe(watched)
        expect(hasUnwatchedButton).toBe(!watched)
        unmount()
      }),
      { numRuns: 100 }
    )
  })
})

// ─── Property 4: Rating display invariant ────────────────────────────────────
// For any traktRating in [0,100], badge shows "{rating}%"; null → no badge

describe('Property 4: rating display invariant', () => {
  it('renders "{rating}%" for any integer rating in [0, 100]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (rating) => {
        const data = makeData({ traktRating: rating })
        const { unmount } = render(
          <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
        )
        expect(screen.getByText(`${rating}%`)).toBeTruthy()
        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it('does NOT render a "%" badge when traktRating is null', () => {
    const data = makeData({ traktRating: null })
    render(<EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />)
    // No element ending in "%" from the rating badge
    const allText = document.body.textContent ?? ''
    // The rating badge specifically uses the pattern "{number}%"
    // We check no standalone percentage badge is rendered
    expect(screen.queryByText(/^\d+%$/)).toBeNull()
  })

  it('rating badge text is exactly "{rating}%" with no extra characters', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (rating) => {
        const data = makeData({ traktRating: rating })
        const { unmount } = render(
          <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
        )
        const badge = screen.getByText(`${rating}%`)
        expect(badge.textContent).toBe(`${rating}%`)
        unmount()
      }),
      { numRuns: 50 }
    )
  })
})

// ─── Property 7: Localized title fallback chain ───────────────────────────────
// translatedTitle (non-null) → shown in secondary color
// title (non-null, translatedTitle null) → episode number shown as "第{n}集"
// both null → fallback "第{n}集"

describe('Property 7: localized title fallback chain', () => {
  it('shows translatedTitle when non-null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (translatedTitle, title) => {
          const data = makeData({ translatedTitle, title })
          const { unmount } = render(
            <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
          )
          // translatedTitle should appear in the secondary color paragraph
          expect(screen.getByText(translatedTitle)).toBeTruthy()
          unmount()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('does NOT show translatedTitle paragraph when translatedTitle is null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        (title) => {
          const data = makeData({ translatedTitle: null, title })
          const { unmount } = render(
            <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
          )
          // The secondary-color translated title paragraph should not exist
          // (title itself is not shown as a separate element — only episode number h1)
          const pinkParagraphs = document.querySelectorAll('p.text-\\[\\#f472b6\\]')
          expect(pinkParagraphs.length).toBe(0)
          unmount()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('always renders "第{n}集" as the h1 episode number for any episodeNumber', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (episodeNumber) => {
        const data = makeData({ episodeNumber })
        const { unmount } = render(
          <EpisodeInfoCard data={data} onWatchClick={() => {}} onHistoryClick={() => {}} />
        )
        const h1 = screen.getByRole('heading', { level: 1 })
        expect(h1.textContent).toBe(`第${episodeNumber}集`)
        unmount()
      }),
      { numRuns: 100 }
    )
  })
})

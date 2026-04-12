// Feature: show-detail-ergonomic-redesign, Property 2: Season tab count matches seasons array
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as fc from 'fast-check'
import type { ShowProgress, SeasonProgress, Show } from '@trakt-dashboard/types'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1' }),
  useNavigate: () => vi.fn(),
}))

// Mock hooks
const mockUseShowDetail = vi.fn()
vi.mock('../../hooks', () => ({
  useShowDetail: (...args: unknown[]) => mockUseShowDetail(...args),
}))

// Import after mocks
const { default: ShowDetailPage } = await import('../ShowDetailPage')

function makeShow(overrides: Partial<Show> = {}): Show {
  return {
    id: 1, tmdbId: 1, tvdbId: null, imdbId: null, traktId: null, traktSlug: null,
    title: 'Test Show', overview: 'Overview', status: 'ended', firstAired: '2020-01-01',
    network: 'Netflix', genres: [], posterPath: null, backdropPath: null,
    totalEpisodes: 10, totalSeasons: 2, lastSyncedAt: '', createdAt: '',
    originalName: null, translatedName: null, displayLanguage: null,
    ...overrides,
  }
}

function makeSeason(n: number): SeasonProgress {
  return {
    seasonNumber: n,
    episodeCount: 3,
    watchedCount: 1,
    airedCount: 3,
    posterPath: null,
    episodes: [
      { episodeId: n * 10 + 1, seasonNumber: n, episodeNumber: 1, title: `Ep 1`, translatedTitle: null, overview: null, translatedOverview: null, airDate: '2020-01-01', watched: true, watchedAt: '2020-01-02', aired: true, stillPath: null, runtime: 45 },
      { episodeId: n * 10 + 2, seasonNumber: n, episodeNumber: 2, title: `Ep 2`, translatedTitle: null, overview: null, translatedOverview: null, airDate: '2020-01-08', watched: false, watchedAt: null, aired: true, stillPath: null, runtime: 45 },
      { episodeId: n * 10 + 3, seasonNumber: n, episodeNumber: 3, title: `Ep 3`, translatedTitle: null, overview: null, translatedOverview: null, airDate: null, watched: false, watchedAt: null, aired: false, stillPath: null, runtime: null },
    ],
  }
}

function makeProgress(seasons: SeasonProgress[]): ShowProgress {
  return {
    show: makeShow(),
    airedEpisodes: 6,
    watchedEpisodes: 2,
    nextEpisode: null,
    lastWatchedAt: '2024-01-01',
    completed: false,
    percentage: 33,
    seasons,
  }
}

describe('ShowDetailPage', () => {
  it('shows loading spinner when isLoading=true', () => {
    mockUseShowDetail.mockReturnValue({ data: undefined, isLoading: true })
    const { container } = render(<ShowDetailPage />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when data is undefined', () => {
    mockUseShowDetail.mockReturnValue({ data: undefined, isLoading: false })
    render(<ShowDetailPage />)
    expect(screen.getByText('未找到该剧集。')).toBeTruthy()
  })

  it('renders season tabs for each season', () => {
    const seasons = [makeSeason(1), makeSeason(2)]
    mockUseShowDetail.mockReturnValue({ data: makeProgress(seasons), isLoading: false })
    const { container } = render(<ShowDetailPage />)
    const buttons = container.querySelectorAll('button')
    // Back button + 2 season tabs = at least 3 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('第 1 季')).toBeTruthy()
    expect(screen.getByText('第 2 季')).toBeTruthy()
  })

  it('clicking a SeasonTab updates active season', () => {
    const seasons = [makeSeason(1), makeSeason(2)]
    mockUseShowDetail.mockReturnValue({ data: makeProgress(seasons), isLoading: false })
    render(<ShowDetailPage />)
    // Click season 2 tab
    fireEvent.click(screen.getByText('第 2 季'))
    // Season 2 episodes should now be visible (S02E01)
    expect(screen.getByText('S02E01')).toBeTruthy()
  })

  // Property 2: season tab count matches seasons array
  it('P2: rendered SeasonTab count equals seasons.length', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 8 }),
        (seasonNums) => {
          // Deduplicate season numbers
          const unique = [...new Set(seasonNums)]
          const seasons = unique.map(n => makeSeason(n))
          mockUseShowDetail.mockReturnValue({ data: makeProgress(seasons), isLoading: false })
          const { container, unmount } = render(<ShowDetailPage />)
          // Count season tab buttons (exclude back button by checking for season label text)
          const seasonLabels = container.querySelectorAll('button span')
          const seasonTabCount = Array.from(seasonLabels).filter(el =>
            el.textContent?.match(/^第 \d+ 季$/)
          ).length
          expect(seasonTabCount).toBe(unique.length)
          unmount()
        }
      )
    )
  })
})

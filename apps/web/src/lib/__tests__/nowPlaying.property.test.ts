// Feature: now-playing-popup, Property 2: 剩余时间格式正确性
// Feature: now-playing-popup, Property 3: 播放进度百分比有界性
// Feature: now-playing-popup, Property 4: S·E 格式化正确性
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  computeRemainingMinutes,
  computeProgressPct,
  formatSeasonEpisode,
} from '../../components/NowPlayingPopup'

// ─── Property 2: 剩余时间格式正确性 ──────────────────────────────────────────

describe('Property 2: remaining time label correctness', () => {
  it('remainingMinutes equals Math.round((expiresAt - now) / 60_000) when expiresAt > now', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 180 }),   // future minutes (1..180)
        fc.integer({ min: 0, max: 59 }),    // extra seconds offset
        (futureMinutes, extraSeconds) => {
          const now = Date.now()
          const expiresAt = new Date(now + futureMinutes * 60_000 + extraSeconds * 1000).toISOString()
          const result = computeRemainingMinutes(expiresAt, now)
          const expected = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 60_000))
          expect(result).toBe(expected)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('remainingMinutes is 0 when expiresAt is in the past', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3600 }),  // seconds in the past
        (secondsAgo) => {
          const now = Date.now()
          const expiresAt = new Date(now - secondsAgo * 1000).toISOString()
          expect(computeRemainingMinutes(expiresAt, now)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 3: 播放进度百分比有界性 ────────────────────────────────────────

describe('Property 3: progress percentage is bounded [0, 100]', () => {
  it('progressPct is always in [0, 100] for any runtime and remainingMinutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),   // runtime in minutes
        fc.integer({ min: 0, max: 400 }),   // remainingMinutes (can exceed runtime)
        (runtime, remainingMinutes) => {
          const pct = computeProgressPct(runtime, remainingMinutes)
          expect(pct).toBeGreaterThanOrEqual(0)
          expect(pct).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('progressPct is 0 when remainingMinutes >= runtime', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        (runtime) => {
          // remaining >= runtime means nothing has played yet (or hasn't started)
          expect(computeProgressPct(runtime, runtime)).toBe(0)
          expect(computeProgressPct(runtime, runtime + 10)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('progressPct is 100 when remainingMinutes <= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        (runtime) => {
          expect(computeProgressPct(runtime, 0)).toBe(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('progressPct is 0 when runtime is null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        (remaining) => {
          expect(computeProgressPct(null, remaining)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 4: S·E 格式化正确性 ────────────────────────────────────────────

describe('Property 4: S·E label format correctness', () => {
  it('formatSeasonEpisode returns S{N}·E{N} for any positive integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 99 }),
        (seasonNumber, episodeNumber) => {
          const label = formatSeasonEpisode(seasonNumber, episodeNumber)
          expect(label).toBe(`S${seasonNumber}·E${episodeNumber}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})

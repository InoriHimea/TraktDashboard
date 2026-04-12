// Feature: show-detail-ergonomic-redesign, Property 13: Last-watched date zh-CN relative format
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { fmtDateZh, resolveTitle } from '../utils'
import type { Show } from '@trakt-dashboard/types'

describe('fmtDateZh', () => {
  it('returns 从未 for null', () => {
    expect(fmtDateZh(null)).toBe('从未')
  })

  it('returns 今天 for today', () => {
    expect(fmtDateZh(new Date().toISOString())).toBe('今天')
  })

  it('returns 昨天 for yesterday', () => {
    const d = new Date(Date.now() - 86400000)
    expect(fmtDateZh(d.toISOString())).toBe('昨天')
  })

  // Property 13: fmtDateZh output is always a non-empty zh-CN string
  it('P13: always returns non-empty string for any date', () => {
    fc.assert(
      fc.property(fc.option(fc.date({ min: new Date('2000-01-01'), max: new Date() })), (d) => {
        const result = fmtDateZh(d ? d.toISOString() : null)
        expect(result.length).toBeGreaterThan(0)
        // Must not be an ASCII-only date string (no pure English month names)
        expect(result).not.toMatch(/^[A-Za-z]/)
      })
    )
  })
})

describe('resolveTitle', () => {
  const baseShow: Show = {
    id: 1, tmdbId: 1, tvdbId: null, imdbId: null, traktId: null, traktSlug: null,
    title: 'Test Show', overview: null, status: 'ended', firstAired: null,
    network: null, genres: [], posterPath: null, backdropPath: null,
    totalEpisodes: 0, totalSeasons: 0, lastSyncedAt: '', createdAt: '',
    originalName: null, translatedName: null, translatedOverview: null, displayLanguage: null,
  }

  it('returns translatedName as primary when displayLanguage is zh-CN', () => {
    const show = { ...baseShow, translatedName: '测试剧', displayLanguage: 'zh-CN' }
    const { primary } = resolveTitle(show)
    expect(primary).toBe('测试剧')
  })

  it('returns show.title when translatedName is null', () => {
    const { primary } = resolveTitle(baseShow)
    expect(primary).toBe('Test Show')
  })

  it('returns show.title when displayLanguage is not zh-CN', () => {
    const show = { ...baseShow, translatedName: 'Translated', displayLanguage: 'en' }
    const { primary } = resolveTitle(show)
    expect(primary).toBe('Test Show')
  })
})

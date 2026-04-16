import { describe, it, expect, mock } from 'bun:test';
import fc from 'fast-check';
// ─── Mock DB and dependencies before importing the module ─────────────────────
const mockInsert = mock(() => ({
    values: mock(() => ({
        onConflictDoUpdate: mock(() => Promise.resolve()),
    })),
}));
const mockSelect = mock(() => ({
    from: mock(() => ({
        where: mock(() => Promise.resolve([])),
    })),
}));
const mockDb = { insert: mockInsert, select: mockSelect };
mock.module('@trakt-dashboard/db', () => ({
    getDb: () => mockDb,
    users: { id: 'id', traktAccessToken: 'traktAccessToken', tokenExpiresAt: 'tokenExpiresAt' },
    metadataCache: { source: 'source', externalId: 'externalId', cachedAt: 'cachedAt' },
}));
mock.module('drizzle-orm', () => ({
    eq: (a, b) => ({ eq: [a, b] }),
    and: (...args) => ({ and: args }),
}));
mock.module('../../../jobs/scheduler.js', () => ({
    getRedis: () => ({}),
}));
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMockUser(token = 'tok', expiresAt = new Date(Date.now() + 9999999)) {
    return { traktAccessToken: token, tokenExpiresAt: expiresAt };
}
function makeShowDetail(traktId) {
    return {
        title: 'Test Show',
        year: 2020,
        overview: 'Overview',
        status: 'returning series',
        first_aired: '2020-01-01T00:00:00.000Z',
        network: 'HBO',
        genres: ['drama'],
        ids: { trakt: traktId, slug: 'test-show', tvdb: 1, imdb: 'tt123', tmdb: 999 },
    };
}
function makeSeasonDetail(number) {
    return {
        number,
        episode_count: 10,
        first_aired: number === 0 ? null : '2020-01-01T00:00:00.000Z',
        overview: null,
        ids: { trakt: number + 100, tvdb: null, tmdb: null },
    };
}
function makeEpisodeDetail(epNumber, firstAired = '2020-01-01T00:00:00.000Z') {
    return {
        number: epNumber,
        season: 1,
        title: firstAired ? `Episode ${epNumber}` : null,
        overview: firstAired ? 'Overview' : null,
        first_aired: firstAired,
        runtime: firstAired ? 45 : null,
        ids: { trakt: epNumber + 1000, tvdb: null, imdb: null, tmdb: firstAired ? epNumber + 2000 : null },
    };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Trakt Client - Property Tests', () => {
    // Feature: trakt-primary-datasource, Property 2: 非 200 状态码始终抛出错误
    describe('Property 2: non-200 status codes always throw', () => {
        it('getShowDetail throws for any 4xx/5xx status', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 400, max: 599 }), async (traktId, statusCode) => {
                // Setup: user found, no cache, fetch returns error status
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                const fetchMock = mock(() => Promise.resolve({
                    status: statusCode,
                    ok: false,
                    headers: { get: () => null },
                    text: () => Promise.resolve('Error'),
                }));
                globalThis.fetch = fetchMock;
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await expect(client.getShowDetail(traktId, 1)).rejects.toThrow();
            }), { numRuns: 20 });
        });
        it('getSeasons throws for any 4xx/5xx status', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 400, max: 599 }), async (traktId, statusCode) => {
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: statusCode,
                    ok: false,
                    headers: { get: () => null },
                    text: () => Promise.resolve('Error'),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await expect(client.getSeasons(traktId, 1)).rejects.toThrow();
            }), { numRuns: 20 });
        });
        it('getEpisodes throws for any 4xx/5xx status', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 400, max: 599 }), async (traktId, seasonNum, statusCode) => {
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: statusCode,
                    ok: false,
                    headers: { get: () => null },
                    text: () => Promise.resolve('Error'),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await expect(client.getEpisodes(traktId, seasonNum, 1)).rejects.toThrow();
            }), { numRuns: 20 });
        });
    });
    // Feature: trakt-primary-datasource, Property 4: 缓存写入使用正确的键格式
    describe('Property 4: cache keys follow correct format', () => {
        it('getShowDetail uses externalId trakt_show_{traktId}', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 999999 }), async (traktId) => {
                const capturedInserts = [];
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                mockDb.insert = mock(() => ({
                    values: mock((v) => {
                        capturedInserts.push(v);
                        return { onConflictDoUpdate: mock(() => Promise.resolve()) };
                    }),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: 200,
                    ok: true,
                    headers: { get: () => null },
                    json: () => Promise.resolve(makeShowDetail(traktId)),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await client.getShowDetail(traktId, 1);
                const cacheInsert = capturedInserts.find(v => v.source === 'trakt_show');
                expect(cacheInsert?.externalId).toBe(`trakt_show_${traktId}`);
            }), { numRuns: 20 });
        });
        it('getSeasons uses externalId trakt_seasons_{traktId}', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 999999 }), async (traktId) => {
                const capturedInserts = [];
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                mockDb.insert = mock(() => ({
                    values: mock((v) => {
                        capturedInserts.push(v);
                        return { onConflictDoUpdate: mock(() => Promise.resolve()) };
                    }),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: 200,
                    ok: true,
                    headers: { get: () => null },
                    json: () => Promise.resolve([makeSeasonDetail(1)]),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await client.getSeasons(traktId, 1);
                const cacheInsert = capturedInserts.find(v => v.source === 'trakt_seasons');
                expect(cacheInsert?.externalId).toBe(`trakt_seasons_${traktId}`);
            }), { numRuns: 20 });
        });
        it('getEpisodes uses externalId trakt_episodes_{traktId}_s{seasonNumber}', async () => {
            await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 0, max: 20 }), async (traktId, seasonNum) => {
                const capturedInserts = [];
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                mockDb.insert = mock(() => ({
                    values: mock((v) => {
                        capturedInserts.push(v);
                        return { onConflictDoUpdate: mock(() => Promise.resolve()) };
                    }),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: 200,
                    ok: true,
                    headers: { get: () => null },
                    json: () => Promise.resolve([makeEpisodeDetail(1)]),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                await client.getEpisodes(traktId, seasonNum, 1);
                const cacheInsert = capturedInserts.find(v => v.source === 'trakt_episodes');
                expect(cacheInsert?.externalId).toBe(`trakt_episodes_${traktId}_s${seasonNum}`);
            }), { numRuns: 20 });
        });
    });
    // Feature: trakt-primary-datasource, Property 5: Season 0 不被过滤
    describe('Property 5: Season 0 (Specials) is not filtered', () => {
        it('getSeasons returns season 0 when present', async () => {
            await fc.assert(fc.asyncProperty(fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 5 }), async (extraSeasonNumbers) => {
                const allSeasons = [0, ...extraSeasonNumbers].map(makeSeasonDetail);
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                mockDb.insert = mock(() => ({
                    values: mock(() => ({ onConflictDoUpdate: mock(() => Promise.resolve()) })),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: 200,
                    ok: true,
                    headers: { get: () => null },
                    json: () => Promise.resolve(allSeasons),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                const result = await client.getSeasons(1, 1);
                expect(result.some(s => s.number === 0)).toBe(true);
            }), { numRuns: 30 });
        });
    });
    // Feature: trakt-primary-datasource, Property 6: TBA 集数不被过滤
    describe('Property 6: TBA episodes are not filtered', () => {
        it('getEpisodes returns episodes with null first_aired', async () => {
            await fc.assert(fc.asyncProperty(fc.array(fc.integer({ min: 2, max: 20 }), { minLength: 0, maxLength: 5 }), async (airedEpNumbers) => {
                // Always include at least one TBA episode (ep 1)
                const tbaEp = makeEpisodeDetail(1, null);
                const airedEps = airedEpNumbers.map(n => makeEpisodeDetail(n, '2020-01-01T00:00:00.000Z'));
                const allEps = [tbaEp, ...airedEps];
                mockDb.select = mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve([makeMockUser()])),
                    })),
                }));
                mockDb.insert = mock(() => ({
                    values: mock(() => ({ onConflictDoUpdate: mock(() => Promise.resolve()) })),
                }));
                globalThis.fetch = mock(() => Promise.resolve({
                    status: 200,
                    ok: true,
                    headers: { get: () => null },
                    json: () => Promise.resolve(allEps),
                }));
                const { getTraktClient } = await import('../trakt.js');
                const client = getTraktClient();
                const result = await client.getEpisodes(1, 1, 1);
                expect(result.some(e => e.first_aired === null)).toBe(true);
            }), { numRuns: 30 });
        });
    });
});
//# sourceMappingURL=trakt.property.test.js.map
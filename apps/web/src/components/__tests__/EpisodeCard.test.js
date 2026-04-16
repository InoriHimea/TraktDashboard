import { jsx as _jsx } from "react/jsx-runtime";
// Feature: show-detail-ergonomic-redesign, Property 6: Episode context string format
// Feature: show-detail-ergonomic-redesign, Property 7: Episode title display
// Feature: show-detail-ergonomic-redesign, Property 8: Episode watched state determines progress bar fill
// Feature: show-detail-ergonomic-redesign, Property 9: Unaired episode card state
// Feature: show-detail-ergonomic-redesign, Property 10: Watch-count indicator visibility
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { EpisodeCard } from '../EpisodeCard';
function makeEpisode(overrides = {}) {
    return {
        episodeId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: 'Test Episode',
        airDate: '2024-01-01',
        watched: false,
        watchedAt: null,
        aired: true,
        ...overrides,
    };
}
describe('EpisodeCard', () => {
    it('always renders Tv2 placeholder (no stillPath)', () => {
        const { container } = render(_jsx(EpisodeCard, { episode: makeEpisode(), index: 0, seasonNumber: 1 }));
        // The placeholder div with bg-neutral-800 should be present
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
    });
    it('renders 未播出 badge when aired=false', () => {
        render(_jsx(EpisodeCard, { episode: makeEpisode({ aired: false }), index: 0, seasonNumber: 1 }));
        expect(screen.getByText('未播出')).toBeTruthy();
    });
    it('does not render 未播出 badge when aired=true', () => {
        render(_jsx(EpisodeCard, { episode: makeEpisode({ aired: true }), index: 0, seasonNumber: 1 }));
        expect(screen.queryByText('未播出')).toBeNull();
    });
    // Property 6: context string format
    it('P6: context label follows S0XE0Y pattern', () => {
        fc.assert(fc.property(fc.nat({ max: 99 }), fc.nat({ max: 99 }), (seasonNumber, episodeNumber) => {
            const expected = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;
            const { unmount } = render(_jsx(EpisodeCard, { episode: makeEpisode({ episodeNumber }), index: 0, seasonNumber: seasonNumber }));
            expect(screen.getByText(expected)).toBeTruthy();
            unmount();
        }));
    });
    // Property 7: episode title display
    it('P7: non-null title is displayed; null title shows fallback', () => {
        fc.assert(fc.property(fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)), (title) => {
            const ep = makeEpisode({ title: title ?? null, episodeNumber: 5 });
            const { container, unmount } = render(_jsx(EpisodeCard, { episode: ep, index: 0, seasonNumber: 1 }));
            const h3 = container.querySelector('h3');
            if (title) {
                expect(h3.textContent).toBe(title);
            }
            else {
                expect(h3.textContent).toBe('第 5 集');
            }
            unmount();
        }));
    });
    // Property 9: unaired card state
    it('P9: unaired card has reduced opacity and 未播出 text', () => {
        fc.assert(fc.property(fc.record({ episodeNumber: fc.nat({ max: 20 }) }), ({ episodeNumber }) => {
            const { container, unmount } = render(_jsx(EpisodeCard, { episode: makeEpisode({ aired: false, watched: false, episodeNumber }), index: 0, seasonNumber: 1 }));
            const card = container.firstChild;
            expect(card.className).toContain('opacity-[0.55]');
            expect(screen.getByText('未播出')).toBeTruthy();
            unmount();
        }));
    });
    // Property 10: watch-count indicator visibility (watchCount derived as watched ? 1 : 0)
    it('P10: watch-count indicator not shown when watchCount <= 1', () => {
        // With current data model, watchCount is always 0 or 1
        const { container } = render(_jsx(EpisodeCard, { episode: makeEpisode({ watched: true }), index: 0, seasonNumber: 1 }));
        // watchCount = 1, indicator should NOT appear (only shows when > 1)
        expect(container.querySelector('.text-neutral-500')?.textContent).not.toContain('×');
    });
});
//# sourceMappingURL=EpisodeCard.test.js.map
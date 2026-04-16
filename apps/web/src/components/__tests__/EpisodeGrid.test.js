import { jsx as _jsx } from "react/jsx-runtime";
// Feature: show-detail-ergonomic-redesign, Property 5: EpisodeCard count matches episodes array
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { EpisodeGrid } from '../EpisodeGrid';
function makeEpisode(n) {
    return {
        episodeId: n,
        seasonNumber: 1,
        episodeNumber: n,
        title: `Episode ${n}`,
        airDate: '2024-01-01',
        watched: false,
        watchedAt: null,
        aired: true,
    };
}
describe('EpisodeGrid', () => {
    it('renders correct number of episode cards', () => {
        const episodes = [makeEpisode(1), makeEpisode(2), makeEpisode(3)];
        const { container } = render(_jsx(EpisodeGrid, { episodes: episodes, seasonNumber: 1 }));
        // Each EpisodeCard has a tabIndex=0 div
        const cards = container.querySelectorAll('[tabindex="0"]');
        expect(cards.length).toBe(3);
    });
    it('renders empty grid for empty episodes array', () => {
        const { container } = render(_jsx(EpisodeGrid, { episodes: [], seasonNumber: 1 }));
        const cards = container.querySelectorAll('[tabindex="0"]');
        expect(cards.length).toBe(0);
    });
    // Property 5: EpisodeCard count matches episodes array length
    it('P5: rendered card count equals episodes.length', () => {
        fc.assert(fc.property(fc.array(fc.nat({ max: 50 }), { maxLength: 15 }), (nums) => {
            const episodes = nums.map((n, i) => makeEpisode(i + 1));
            const { container, unmount } = render(_jsx(EpisodeGrid, { episodes: episodes, seasonNumber: 1 }));
            const cards = container.querySelectorAll('[tabindex="0"]');
            expect(cards.length).toBe(episodes.length);
            unmount();
        }));
    });
});
//# sourceMappingURL=EpisodeGrid.test.js.map
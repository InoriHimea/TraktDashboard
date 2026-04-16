import { jsx as _jsx } from "react/jsx-runtime";
// Feature: show-detail-ergonomic-redesign, Property 3: Season tab label format
// Feature: show-detail-ergonomic-redesign, Property 4: CompletionBadge visibility
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { SeasonTab } from '../SeasonTab';
function makeSeason(overrides = {}) {
    return {
        seasonNumber: 1,
        episodeCount: 10,
        watchedCount: 0,
        airedCount: 10,
        posterPath: null,
        episodes: [],
        ...overrides,
    };
}
describe('SeasonTab', () => {
    it('renders poster fallback when showPosterPath is null', () => {
        const { container } = render(_jsx(SeasonTab, { season: makeSeason({ posterPath: null }), isActive: false, onClick: () => { } }));
        // No img element when posterPath is null
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
    });
    it('applies active classes when isActive=true', () => {
        const { container } = render(_jsx(SeasonTab, { season: makeSeason({ posterPath: null }), isActive: true, onClick: () => { } }));
        const btn = container.querySelector('button');
        expect(btn.className).toContain('border-violet-500');
    });
    it('applies inactive classes when isActive=false', () => {
        const { container } = render(_jsx(SeasonTab, { season: makeSeason({ posterPath: null }), isActive: false, onClick: () => { } }));
        const btn = container.querySelector('button');
        expect(btn.className).toContain('border-white/10');
    });
    it('calls onClick when clicked', () => {
        const onClick = vi.fn();
        render(_jsx(SeasonTab, { season: makeSeason({ posterPath: null }), isActive: false, onClick: onClick }));
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });
    // Property 3: season tab label format
    it('P3: label follows 第 N 季 pattern', () => {
        fc.assert(fc.property(fc.nat({ max: 50 }), (seasonNumber) => {
            const { unmount } = render(_jsx(SeasonTab, { season: makeSeason({ seasonNumber }), isActive: false, onClick: () => { } }));
            expect(screen.getByText(`第 ${seasonNumber} 季`)).toBeTruthy();
            unmount();
        }));
    });
    // Property 4: CompletionBadge visibility
    it('P4: badge visible iff watchedCount === airedCount && airedCount > 0', () => {
        fc.assert(fc.property(fc.record({ watchedCount: fc.nat({ max: 20 }), airedCount: fc.nat({ max: 20 }) }), ({ watchedCount, airedCount }) => {
            const { container, unmount } = render(_jsx(SeasonTab, { season: makeSeason({ watchedCount, airedCount }), isActive: false, onClick: () => { } }));
            const badge = container.querySelector('.bg-violet-500.rounded-full.h-5.w-5');
            const shouldShow = watchedCount === airedCount && airedCount > 0;
            if (shouldShow) {
                expect(badge).toBeTruthy();
            }
            else {
                expect(badge).toBeNull();
            }
            unmount();
        }));
    });
});
//# sourceMappingURL=SeasonTab.test.js.map
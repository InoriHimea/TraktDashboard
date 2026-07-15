import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JellyfinActivityEntry } from "@trakt-dashboard/types";
import { ActivityFeed } from "../ActivityFeed";

function makeEntry(overrides: Partial<JellyfinActivityEntry> = {}): JellyfinActivityEntry {
    return {
        date: "2026-07-15T10:00:00.000Z",
        name: "Some Episode",
        type: "VideoPlayback",
        userName: "alice",
        itemId: "abc",
        ...overrides,
    };
}

describe("ActivityFeed", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders skeleton placeholders while loading", () => {
        const { container } = render(<ActivityFeed data={[]} isLoading={true} />);
        expect(screen.getByText("最近播放")).toBeInTheDocument();
        expect(screen.queryByText("暂无播放记录")).not.toBeInTheDocument();
        expect(container.querySelectorAll('[style*="pulse"]').length).toBe(5);
    });

    it("shows the empty state when not loading and there is no data", () => {
        render(<ActivityFeed data={[]} isLoading={false} />);
        expect(screen.getByText("暂无播放记录")).toBeInTheDocument();
    });

    it("renders an entry row per item with name, userName, relative time, and the right icon", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
        // isMovie: name includes "movie" OR type === "VideoPlaybackStopped".
        const movieEntry = makeEntry({
            name: "Some Movie",
            type: "VideoPlaybackStopped",
            date: "2026-07-15T10:00:00.000Z",
        });
        const episodeEntry = makeEntry({
            name: "Some Episode",
            type: "VideoPlayback",
            userName: null,
            date: "2026-07-13T12:00:00.000Z",
        });

        const { container } = render(
            <ActivityFeed data={[movieEntry, episodeEntry]} isLoading={false} />,
        );

        expect(screen.getByText("Some Movie")).toBeInTheDocument();
        expect(screen.getByText("alice")).toBeInTheDocument();
        expect(screen.getByText("2 hours ago")).toBeInTheDocument();

        expect(screen.getByText("Some Episode")).toBeInTheDocument();
        expect(screen.getByText("2 days ago")).toBeInTheDocument();
        // no userName on the 2nd entry -> only 1 userName line rendered.
        expect(screen.queryByText("null")).not.toBeInTheDocument();

        expect(container.querySelectorAll(".lucide-film").length).toBe(1);
        expect(container.querySelectorAll(".lucide-tv-minimal").length).toBe(1);
    });
});

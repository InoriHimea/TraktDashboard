import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { applyTheme, persistTheme, loadTheme } from "../lib/theme";
import { barColor, COLORS, GENRE_COLORS } from "../pages/stats/tokens";

// localStorage is not available in this Vitest/jsdom configuration;
// use a simple in-memory stub so persistTheme/loadTheme tests still cover the code paths.
const localStorageStub = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
            store[k] = v;
        },
        removeItem: (k: string) => {
            delete store[k];
        },
        clear: () => {
            store = {};
        },
    };
})();

// ---------------------------------------------------------------------------
// lib/theme — pure theme helpers
// ---------------------------------------------------------------------------

describe("applyTheme", () => {
    beforeEach(() => {
        delete document.documentElement.dataset.theme;
    });

    it("sets data-theme=light for light theme", () => {
        applyTheme("light");
        expect(document.documentElement.dataset.theme).toBe("light");
    });

    it("removes data-theme for dark theme", () => {
        document.documentElement.dataset.theme = "light";
        applyTheme("dark");
        expect(document.documentElement.dataset.theme).toBeUndefined();
    });
});

describe("persistTheme / loadTheme", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", localStorageStub);
        localStorageStub.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("persists and loads dark theme", () => {
        persistTheme("dark");
        expect(loadTheme()).toBe("dark");
    });

    it("persists and loads light theme", () => {
        persistTheme("light");
        expect(loadTheme()).toBe("light");
    });

    it("defaults to dark when nothing stored", () => {
        expect(loadTheme()).toBe("dark");
    });

    it("handles localStorage error gracefully in persistTheme", () => {
        vi.stubGlobal("localStorage", {
            ...localStorageStub,
            setItem: () => {
                throw new Error("quota");
            },
        });
        expect(() => persistTheme("light")).not.toThrow();
    });

    it("handles localStorage error gracefully in loadTheme", () => {
        vi.stubGlobal("localStorage", {
            ...localStorageStub,
            getItem: () => {
                throw new Error("security");
            },
        });
        expect(loadTheme()).toBe("dark");
    });
});

// ---------------------------------------------------------------------------
// pages/stats/tokens — barColor and exports
// ---------------------------------------------------------------------------

describe("barColor", () => {
    it("returns violet for values >= 85% of max", () => {
        expect(barColor(90, 100)).toBe(COLORS.violet.base);
        expect(barColor(85, 100)).toBe(COLORS.violet.base);
    });

    it("returns sky for values >= 60% of max", () => {
        expect(barColor(60, 100)).toBe(COLORS.sky.base);
        expect(barColor(75, 100)).toBe(COLORS.sky.base);
    });

    it("returns emerald for values >= 35% of max", () => {
        expect(barColor(35, 100)).toBe(COLORS.emerald.base);
        expect(barColor(50, 100)).toBe(COLORS.emerald.base);
    });

    it("returns amber for low values", () => {
        expect(barColor(10, 100)).toBe(COLORS.amber.base);
        expect(barColor(0, 100)).toBe(COLORS.amber.base);
    });
});

describe("GENRE_COLORS", () => {
    it("has 7 color entries", () => {
        expect(GENRE_COLORS).toHaveLength(7);
    });

    it("each entry has base, light, and bg", () => {
        for (const c of GENRE_COLORS) {
            expect(c).toHaveProperty("base");
            expect(c).toHaveProperty("light");
            expect(c).toHaveProperty("bg");
        }
    });
});

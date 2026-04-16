export type Theme = "dark" | "light";

export function applyTheme(theme: Theme): void {
    if (theme === "light") {
        document.documentElement.dataset.theme = "light";
    } else {
        delete document.documentElement.dataset.theme;
    }
}

export function persistTheme(theme: Theme): void {
    try {
        localStorage.setItem("theme", theme);
    } catch (e) {
        console.warn("[theme] Failed to persist theme to localStorage:", e);
    }
}

export function loadTheme(): Theme {
    try {
        const stored = localStorage.getItem("theme");
        if (stored === "light" || stored === "dark") return stored;
    } catch (e) {
        console.warn("[theme] Failed to load theme from localStorage:", e);
    }
    return "dark";
}

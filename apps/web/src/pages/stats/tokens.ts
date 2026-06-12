export const CARD_BG =
    "linear-gradient(180deg, rgba(141,252,255,0.045), transparent 42%), var(--color-panel-glass)";
export const CARD_BDR = "1px solid var(--color-border-subtle)";
export const CARD_BLR = "blur(24px)";
export const CARD_SHD = "var(--shadow-hud)";
export const T1 = "var(--color-text)";
export const T2 = "var(--color-text-secondary)";
export const T3 = "var(--color-text-muted)";

export const COLORS = {
    cyan: {
        base: "var(--color-accent)",
        light: "var(--color-accent-light)",
        bg: "rgba(37,244,238,0.14)",
    },
    violet: { base: "var(--color-accent-violet)", light: "#c4b5fd", bg: "rgba(139,92,246,0.15)" },
    emerald: { base: "#06b981", light: "var(--color-watched)", bg: "rgba(49,245,168,0.13)" },
    amber: { base: "#d97706", light: "var(--color-airing)", bg: "rgba(248,211,92,0.14)" },
    sky: { base: "#38bdf8", light: "#7dd3fc", bg: "rgba(56,189,248,0.13)" },
    rose: { base: "var(--color-accent-rose)", light: "#ff8fb4", bg: "rgba(255,61,129,0.14)" },
    teal: { base: "#14b8a6", light: "#5eead4", bg: "rgba(20,184,166,0.13)" },
};

export const GENRE_COLORS = [
    COLORS.cyan,
    COLORS.violet,
    COLORS.emerald,
    COLORS.amber,
    COLORS.sky,
    COLORS.rose,
    COLORS.teal,
];

export type ChartColor = (typeof COLORS)[keyof typeof COLORS];

export function barColor(value: number, max: number): string {
    const ratio = value / max;
    if (ratio >= 0.85) return COLORS.violet.base;
    if (ratio >= 0.6) return COLORS.sky.base;
    if (ratio >= 0.35) return COLORS.emerald.base;
    return COLORS.amber.base;
}

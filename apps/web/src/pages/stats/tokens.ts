export const CARD_BG = "var(--color-surface)";
export const CARD_BDR = "1px solid var(--color-border)";
export const CARD_BLR = "blur(24px)";
export const CARD_SHD = "0 4px 24px rgba(0,0,0,0.15)";
export const T1 = "var(--color-text)";
export const T2 = "var(--color-text-secondary)";
export const T3 = "var(--color-text-muted)";

export const COLORS = {
    violet: { base: "#7c6af7", light: "#9d8fff", bg: "rgba(124,106,247,0.15)" },
    emerald: { base: "#10b981", light: "#34d399", bg: "rgba(16,185,129,0.15)" },
    amber: { base: "#f59e0b", light: "#fbbf24", bg: "rgba(245,158,11,0.15)" },
    sky: { base: "#0ea5e9", light: "#38bdf8", bg: "rgba(14,165,233,0.15)" },
    rose: { base: "#f43f5e", light: "#fb7185", bg: "rgba(244,63,94,0.15)" },
    teal: { base: "#14b8a6", light: "#2dd4bf", bg: "rgba(20,184,166,0.15)" },
};

export const GENRE_COLORS = [
    COLORS.violet,
    COLORS.emerald,
    COLORS.amber,
    COLORS.sky,
    COLORS.rose,
    COLORS.teal,
];

export function barColor(value: number, max: number): string {
    const ratio = value / max;
    if (ratio >= 0.85) return COLORS.violet.base;
    if (ratio >= 0.6) return COLORS.sky.base;
    if (ratio >= 0.35) return COLORS.emerald.base;
    return COLORS.amber.base;
}

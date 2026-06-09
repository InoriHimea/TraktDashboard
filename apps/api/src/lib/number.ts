export function parseBoundedInt(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

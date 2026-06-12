// Safe timestamp serialization helpers (P2-T02).
//
// Calling `.toISOString()` directly on a nullable DB column (e.g. watch_history.watched_at)
// throws when the value is null, surfacing as a 500. `toIsoOrNull` makes serialization
// total: null/invalid in → null out, valid Date/string in → ISO string out.

export function toIsoOrNull(value: Date | string | number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    if (Number.isNaN(ms)) return null;
    return date.toISOString();
}

// Single source of truth for the API secret used by both JWT signing
// (middleware/auth.ts) and Trakt token encryption (lib/encrypt.ts callers).
//
// Production requires a real >=32 char secret; outside production we fall back
// to a fixed development secret (warned once) so local and test runs don't crash
// when API_SECRET is unset.

const DEV_FALLBACK_SECRET = "dev-only-secret-change-before-production-1234567890";

let warnedFallback = false;

export function resolveApiSecret(): string {
    const raw = process.env.API_SECRET;
    if (raw && raw.length >= 32) return raw;

    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "[secret] API_SECRET must be set and at least 32 characters long in production",
        );
    }

    if (!warnedFallback) {
        console.warn(
            "[secret] API_SECRET missing or too short — using insecure development fallback",
        );
        warnedFallback = true;
    }
    return DEV_FALLBACK_SECRET;
}

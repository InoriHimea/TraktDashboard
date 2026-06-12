import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Canonical API response helpers (P1-T10). Standardize the success/error envelope
// across routes so the web client always sees `{ ok, data }` / `{ ok: false, error }`.

export function apiOk<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
    return c.json({ ok: true as const, data }, status);
}

export function apiError(
    c: Context,
    status: ContentfulStatusCode,
    error: string,
    details?: unknown,
) {
    return c.json(
        {
            ok: false as const,
            error,
            ...(details !== undefined ? { details } : {}),
        },
        status,
    );
}

export function apiPaginated<T>(
    c: Context,
    data: T[],
    meta: { total: number; limit: number; offset: number },
    status: ContentfulStatusCode = 200,
) {
    return c.json({ ok: true as const, data, ...meta }, status);
}

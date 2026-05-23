import type { Context } from "hono";
import { z } from "zod";

export async function validateBody<T>(
    c: Context,
    schema: z.ZodType<T>,
): Promise<{ data: T } | Response> {
    let raw: unknown;
    try {
        raw = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400) as unknown as Response;
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
        return c.json(
            { error: "Validation failed", details: result.error.issues },
            400,
        ) as unknown as Response;
    }
    return { data: result.data };
}

export function validateQuery<T>(
    c: Context,
    schema: z.ZodType<T>,
): { data: T } | Response {
    const raw = c.req.query();
    const result = schema.safeParse(raw);
    if (!result.success) {
        return c.json(
            { error: "Validation failed", details: result.error.issues },
            400,
        ) as unknown as Response;
    }
    return { data: result.data };
}

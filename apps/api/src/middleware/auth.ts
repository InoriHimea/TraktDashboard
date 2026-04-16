import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";

function resolveAuthSecret(): Uint8Array {
    const rawSecret = process.env.API_SECRET;
    const isProd = process.env.NODE_ENV === "production";

    if (rawSecret && rawSecret.length >= 32) {
        return new TextEncoder().encode(rawSecret);
    }

    if (isProd) {
        throw new Error(
            "[auth] API_SECRET must be set and at least 32 characters long in production",
        );
    }

    const devFallback = "dev-only-secret-change-before-production-1234567890";
    console.warn(
        "[auth] API_SECRET is missing or too short, using development fallback secret",
    );
    return new TextEncoder().encode(devFallback);
}

const secret = resolveAuthSecret();

export async function signToken(userId: number): Promise<string> {
    return new SignJWT({ sub: String(userId) })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(secret);
}

export async function verifyToken(token: string): Promise<number | null> {
    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: ["HS256"],
        });
        return parseInt(payload.sub as string);
    } catch {
        return null;
    }
}

export const authMiddleware = createMiddleware(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, "session");
    const token = authHeader?.replace("Bearer ", "") || cookieToken;

    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = await verifyToken(token);
    if (!userId) {
        return c.json({ error: "Invalid or expired session" }, 401);
    }

    c.set("userId", userId);
    await next();
});

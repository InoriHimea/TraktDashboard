import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import { resolveApiSecret } from "../lib/secret.js";

const secret = new TextEncoder().encode(resolveApiSecret());

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

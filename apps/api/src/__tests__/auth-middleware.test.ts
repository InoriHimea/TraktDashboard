import { Hono } from "hono";
import { describe, expect, it } from "vitest";

// Real jose round-trip against the dev/test secret — no mocks, this is the
// security-critical path and should be exercised end-to-end.
const { signToken, verifyToken, authMiddleware } = await import("../middleware/auth.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", authMiddleware);
    a.get("/me", (c) => c.json({ userId: c.get("userId") }));
    return a;
}

describe("signToken / verifyToken", () => {
    it("round-trips a userId through a signed JWT", async () => {
        const token = await signToken(42);
        expect(typeof token).toBe("string");
        await expect(verifyToken(token)).resolves.toBe(42);
    });

    it("returns null for garbage tokens", async () => {
        await expect(verifyToken("not-a-jwt")).resolves.toBeNull();
    });

    it("returns null for a token signed with a different secret", async () => {
        // Header/payload valid JWT shape but bogus signature.
        const forged =
            "eyJhbGciOiJIUzI1NiJ9." +
            Buffer.from(JSON.stringify({ sub: "42" })).toString("base64url") +
            ".invalidsignature";
        await expect(verifyToken(forged)).resolves.toBeNull();
    });
});

describe("authMiddleware", () => {
    it("rejects requests without any token (401)", async () => {
        const res = await app().request("/me");
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Unauthorized");
    });

    it("rejects invalid tokens (401)", async () => {
        const res = await app().request("/me", {
            headers: { Authorization: "Bearer garbage" },
        });
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Invalid or expired session");
    });

    it("accepts a Bearer token and injects userId", async () => {
        const token = await signToken(42);
        const res = await app().request("/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { userId: number };
        expect(body.userId).toBe(42);
    });

    it("accepts the session cookie as a fallback", async () => {
        const token = await signToken(7);
        const res = await app().request("/me", {
            headers: { Cookie: `session=${token}` },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { userId: number };
        expect(body.userId).toBe(7);
    });

    it("prefers the Authorization header over the cookie", async () => {
        const headerToken = await signToken(1);
        const cookieToken = await signToken(2);
        const res = await app().request("/me", {
            headers: {
                Authorization: `Bearer ${headerToken}`,
                Cookie: `session=${cookieToken}`,
            },
        });
        const body = (await res.json()) as { userId: number };
        expect(body.userId).toBe(1);
    });
});

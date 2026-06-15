import { describe, it, expect, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ db: null as any }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMock.db };
});

import { encryptLegacyTokensAtRest } from "../token-migration.js";
import { encryptToken, decryptToken } from "../encrypt.js";
import { resolveApiSecret } from "../secret.js";

type Row = { id: number; accessToken: string | null; refreshToken: string | null };

function makeDb(rows: Row[]) {
    const updates: Array<{ set: Record<string, string> }> = [];
    return {
        updates,
        select: () => ({ from: () => Promise.resolve(rows) }),
        update: () => ({
            set: (set: Record<string, string>) => ({
                where: () => {
                    updates.push({ set });
                    return Promise.resolve();
                },
            }),
        }),
    };
}

describe("encryptLegacyTokensAtRest", () => {
    it("encrypts plaintext tokens and leaves already-encrypted ones untouched", async () => {
        const secret = resolveApiSecret();
        dbMock.db = makeDb([
            { id: 1, accessToken: "plain-access", refreshToken: "plain-refresh" },
            {
                id: 2,
                accessToken: encryptToken("enc-a", secret),
                refreshToken: encryptToken("enc-r", secret),
            },
            { id: 3, accessToken: "plain-a3", refreshToken: encryptToken("enc-r3", secret) },
        ]);

        const migrated = await encryptLegacyTokensAtRest();

        expect(migrated).toBe(2); // rows 1 and 3
        const { updates } = dbMock.db;
        expect(updates).toHaveLength(2);

        // row 1 — both fields encrypted, round-trip back to the originals
        expect(decryptToken(updates[0].set.traktAccessToken, secret)).toBe("plain-access");
        expect(decryptToken(updates[0].set.traktRefreshToken, secret)).toBe("plain-refresh");

        // row 3 — only the plaintext access token is rewritten
        expect(decryptToken(updates[1].set.traktAccessToken, secret)).toBe("plain-a3");
        expect(updates[1].set.traktRefreshToken).toBeUndefined();
    });

    it("is a no-op when every token is already encrypted", async () => {
        const secret = resolveApiSecret();
        dbMock.db = makeDb([
            {
                id: 1,
                accessToken: encryptToken("a", secret),
                refreshToken: encryptToken("r", secret),
            },
        ]);

        expect(await encryptLegacyTokensAtRest()).toBe(0);
        expect(dbMock.db.updates).toHaveLength(0);
    });
});

import { getDb, users } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import { encryptToken } from "./encrypt.js";
import { resolveApiSecret } from "./secret.js";

/**
 * One-time at-rest encryption of any Trakt tokens still stored as plaintext.
 *
 * Tokens are otherwise only encrypted on the next refresh (auth.ts / trakt.ts),
 * so a long-lived token could sit in the DB unencrypted indefinitely. This runs
 * at startup and is idempotent: values already carrying the `v1:` prefix are
 * left untouched, so re-runs are no-ops.
 *
 * Returns the number of user rows updated.
 */
export async function encryptLegacyTokensAtRest(): Promise<number> {
    const db = getDb();
    const secret = resolveApiSecret();

    const rows = await db
        .select({
            id: users.id,
            accessToken: users.traktAccessToken,
            refreshToken: users.traktRefreshToken,
        })
        .from(users);

    let migrated = 0;
    for (const row of rows) {
        const set: Partial<{ traktAccessToken: string; traktRefreshToken: string }> = {};
        if (row.accessToken && !row.accessToken.startsWith("v1:")) {
            set.traktAccessToken = encryptToken(row.accessToken, secret);
        }
        if (row.refreshToken && !row.refreshToken.startsWith("v1:")) {
            set.traktRefreshToken = encryptToken(row.refreshToken, secret);
        }
        if (Object.keys(set).length > 0) {
            await db.update(users).set(set).where(eq(users.id, row.id));
            migrated++;
        }
    }
    return migrated;
}

import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "../encrypt.js";

const SECRET = "unit-test-secret-at-least-32-characters-long";
const OTHER_SECRET = "another-secret-at-least-32-characters-long!!";

describe("encryptToken / decryptToken", () => {
    it("round-trips a token", () => {
        const plain = "my-access-token-123";
        expect(decryptToken(encryptToken(plain, SECRET), SECRET)).toBe(plain);
    });

    it("produces a v1:iv:data:tag ciphertext that hides the plaintext", () => {
        const enc = encryptToken("super-secret-value", SECRET);
        expect(enc.startsWith("v1:")).toBe(true);
        expect(enc.split(":")).toHaveLength(4);
        expect(enc).not.toContain("super-secret-value");
    });

    it("returns plaintext unchanged when not v1-prefixed (backward compat)", () => {
        expect(decryptToken("legacy-plaintext-token", SECRET)).toBe("legacy-plaintext-token");
    });

    it("uses a fresh IV per call so ciphertexts differ for the same input", () => {
        expect(encryptToken("same", SECRET)).not.toBe(encryptToken("same", SECRET));
    });

    it("rejects a tampered ciphertext via the GCM auth tag", () => {
        const parts = encryptToken("secret", SECRET).split(":");
        parts[3] = parts[3].replace(/^./, (ch) => (ch === "0" ? "1" : "0")); // flip first hex char of tag
        expect(() => decryptToken(parts.join(":"), SECRET)).toThrow();
    });

    it("fails when decrypted with the wrong secret", () => {
        const enc = encryptToken("secret", SECRET);
        expect(() => decryptToken(enc, OTHER_SECRET)).toThrow();
    });

    it("throws on a malformed v1 token", () => {
        expect(() => decryptToken("v1:onlyonesegment", SECRET)).toThrow(/malformed/i);
    });
});

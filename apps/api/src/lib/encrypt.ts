import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function deriveKey(secret: string): Buffer {
    return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string, secret: string): string {
    const key = deriveKey(secret);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptToken(ciphertext: string, secret: string): string {
    if (!ciphertext.startsWith("v1:")) return ciphertext; // backward compat with plaintext tokens
    const parts = ciphertext.split(":");
    if (parts.length !== 4) {
        throw new Error("Malformed encrypted token (expected v1:iv:data:tag)");
    }
    const [, ivHex, dataHex, tagHex] = parts;
    const key = deriveKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex"), undefined, "utf8") + decipher.final("utf8");
}

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function deriveKey(
    password: string,
    salt: Buffer,
    length: number,
    cost = COST,
    blockSize = BLOCK_SIZE,
    parallelization = PARALLELIZATION,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scryptCallback(
            password,
            salt,
            length,
            { N: cost, r: blockSize, p: parallelization },
            (error, derivedKey) => (error ? reject(error) : resolve(derivedKey as Buffer)),
        );
    });
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = await deriveKey(password, salt, KEY_LENGTH);
    return `scrypt:${COST}:${BLOCK_SIZE}:${PARALLELIZATION}:${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] = encoded.split(":");
    if (
        algorithm !== "scrypt" ||
        !cost ||
        !blockSize ||
        !parallelization ||
        !saltValue ||
        !hashValue
    ) {
        return false;
    }

    try {
        const salt = Buffer.from(saltValue, "base64");
        const expected = Buffer.from(hashValue, "base64");
        const actual = await deriveKey(
            password,
            salt,
            expected.length,
            Number(cost),
            Number(blockSize),
            Number(parallelization),
        );
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

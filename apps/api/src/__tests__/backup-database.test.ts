import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// dumpDatabase/restoreDatabase never touch fetch — they spawn pg_dump/psql directly
// (no shell) and pipe data through real gzip/gunzip. Mock only node:child_process's
// spawn; let the actual zlib streams run for real so the test fixtures are
// realistic compressed/decompressed bytes, not stand-ins.
const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

const { dumpDatabase, restoreDatabase } = await import("../services/backup.js");

type FakeChildProcess = EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: PassThrough;
    kill: ReturnType<typeof vi.fn>;
};

function makeFakeChildProcess(): FakeChildProcess {
    const cp = new EventEmitter() as FakeChildProcess;
    cp.stdout = new PassThrough();
    cp.stderr = new PassThrough();
    cp.stdin = new PassThrough();
    cp.kill = vi.fn();
    return cp;
}

const ORIGINAL_ENV = { ...process.env };
const DB_URL = "postgres://user:pass@localhost:5432/db";

// A realistic-length fixture — gzip of a very short string can land under the
// 100-byte "empty dump" threshold on its own, which would make the success
// tests accidentally exercise the empty-dump rejection branch instead.
const SAMPLE_DUMP_SQL =
    "--\n-- PostgreSQL database dump\n--\n\n" +
    "SET statement_timeout = 0;\n".repeat(10) +
    "CREATE TABLE public.users (id integer NOT NULL);\n".repeat(10);

beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = DB_URL;
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
});

describe("dumpDatabase", () => {
    it("throws immediately without spawning when DATABASE_URL is unset", async () => {
        delete process.env.DATABASE_URL;
        await expect(dumpDatabase()).rejects.toThrow("DATABASE_URL not set");
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it("spawns pg_dump directly (no shell) with the connection string as an argument", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = dumpDatabase();
        cp.stdout.end(SAMPLE_DUMP_SQL);
        cp.emit("close", 0);
        const buf = await promise;

        expect(spawnMock).toHaveBeenCalledWith("pg_dump", ["--format=plain", DB_URL], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        expect(gunzipSync(buf).toString("utf8")).toBe(SAMPLE_DUMP_SQL);
    });

    it("rejects with the exit code and truncated stderr on a non-zero pg_dump exit", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = dumpDatabase();
        cp.stderr.end("connection refused");
        cp.emit("close", 1);

        await expect(promise).rejects.toThrow("pg_dump failed (exit 1): connection refused");
    });

    it("rejects when the compressed output is under the empty-dump threshold", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = dumpDatabase();
        cp.stdout.end(""); // gzip envelope alone is well under 100 bytes
        cp.emit("close", 0);

        await expect(promise).rejects.toThrow("pg_dump produced an empty dump");
    });

    it("rejects when pg_dump itself fails to spawn", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = dumpDatabase();
        cp.emit("error", new Error("ENOENT: pg_dump not found"));

        await expect(promise).rejects.toThrow("ENOENT: pg_dump not found");
    });

    it("kills pg_dump and rejects after a 20-minute stall", async () => {
        vi.useFakeTimers();
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = dumpDatabase();
        // Suppress the unhandled-rejection warning race between the timer firing
        // and the assertion below attaching its own rejection handler.
        promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(20 * 60 * 1000);

        await expect(promise).rejects.toThrow("pg_dump timed out after 20 minutes");
        expect(cp.kill).toHaveBeenCalledWith("SIGTERM");
    });
});

describe("restoreDatabase", () => {
    const validDumpGz = gzipSync(Buffer.from(SAMPLE_DUMP_SQL, "utf8"));

    it("throws immediately without spawning when DATABASE_URL is unset", async () => {
        delete process.env.DATABASE_URL;
        await expect(restoreDatabase(validDumpGz)).rejects.toThrow("DATABASE_URL not set");
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it("rejects non-gzip data without spawning psql", async () => {
        await expect(restoreDatabase(Buffer.from("not gzip data"))).rejects.toThrow(
            "backup file is not valid gzip data",
        );
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it("rejects valid gzip that doesn't look like a pg_dump, without spawning psql", async () => {
        const notADump = gzipSync(Buffer.from("just some other gzipped text"));
        await expect(restoreDatabase(notADump)).rejects.toThrow(
            "backup file does not look like a pg_dump",
        );
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it("spawns psql directly (no shell) and pipes the DROP-SCHEMA prelude + dump into stdin", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);
        const written: Buffer[] = [];
        cp.stdin.on("data", (chunk: Buffer) => written.push(chunk));

        const promise = restoreDatabase(validDumpGz);
        cp.emit("close", 0);
        await promise;

        expect(spawnMock).toHaveBeenCalledWith(
            "psql",
            ["-v", "ON_ERROR_STOP=1", "--single-transaction", DB_URL],
            { stdio: ["pipe", "ignore", "pipe"] },
        );
        const stdinText = Buffer.concat(written).toString("utf8");
        expect(stdinText.indexOf("DROP SCHEMA IF EXISTS public CASCADE;")).toBe(0);
        expect(stdinText).toContain("DROP SCHEMA IF EXISTS drizzle CASCADE;");
        expect(stdinText).toContain("CREATE SCHEMA public;");
        // The prelude must precede the replayed dump, not just appear somewhere in it.
        expect(stdinText.indexOf("CREATE SCHEMA public;")).toBeLessThan(
            stdinText.indexOf("PostgreSQL database dump"),
        );
    });

    it("rejects with the exit code and truncated stderr on a non-zero psql exit", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = restoreDatabase(validDumpGz);
        cp.stderr.end("syntax error at end of input");
        cp.emit("close", 2);

        await expect(promise).rejects.toThrow(
            "psql restore failed (exit 2): syntax error at end of input",
        );
    });

    it("rejects when psql itself fails to spawn", async () => {
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = restoreDatabase(validDumpGz);
        cp.emit("error", new Error("ENOENT: psql not found"));

        await expect(promise).rejects.toThrow("ENOENT: psql not found");
    });

    it("kills psql and rejects after a 10-minute stall", async () => {
        vi.useFakeTimers();
        const cp = makeFakeChildProcess();
        spawnMock.mockReturnValue(cp);

        const promise = restoreDatabase(validDumpGz);
        promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

        await expect(promise).rejects.toThrow("psql restore timed out after 10 minutes");
        expect(cp.kill).toHaveBeenCalledWith("SIGTERM");
    });
});

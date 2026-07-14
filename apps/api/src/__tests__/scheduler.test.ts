import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type JobLike = { name: string; data: Record<string, unknown> };
type Processor = (job: JobLike) => Promise<void>;

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));

const queueInstance = vi.hoisted(() => ({
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
    getRepeatableJobs: vi.fn(),
    removeRepeatableByKey: vi.fn(),
    add: vi.fn(),
}));
const redisInstance = vi.hoisted(() => ({
    on: vi.fn(),
    ping: vi.fn(),
}));
const workerCapture = vi.hoisted(() => ({ processor: null as Processor | null }));
// bullmq/ioredis are all invoked with `new`, and an arrow function can't be a
// constructor — use `function` expressions so `new Mock()` works, returning our
// fixed mock instance object (a constructor that explicitly returns an object
// overrides the default `this`).
const QueueMock = vi.hoisted(() =>
    vi.fn(function QueueCtor() {
        return queueInstance;
    }),
);
const WorkerMock = vi.hoisted(() =>
    vi.fn(function WorkerCtor(_name: string, processor: Processor) {
        workerCapture.processor = processor;
        return { on: vi.fn() };
    }),
);
const IORedisMock = vi.hoisted(() =>
    vi.fn(function IORedisCtor() {
        return redisInstance;
    }),
);

const syncMock = vi.hoisted(() => ({
    triggerIncrementalSync: vi.fn(),
    resetStaleRunningSyncs: vi.fn(),
}));
const backupMock = vi.hoisted(() => ({ runScheduledBackup: vi.fn() }));
const airingRemindersMock = vi.hoisted(() => ({ runAiringReminders: vi.fn() }));
const jellyfinAutoDeleteMock = vi.hoisted(() => ({ runJellyfinAutoDelete: vi.fn() }));

vi.mock("bullmq", () => ({ Queue: QueueMock, Worker: WorkerMock }));
vi.mock("ioredis", () => ({ default: IORedisMock }));
vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});
vi.mock("../services/sync.js", () => syncMock);
vi.mock("../routes/backup.js", () => backupMock);
vi.mock("../jobs/airing-reminders.js", () => airingRemindersMock);
vi.mock("../jobs/jellyfin-auto-delete.js", () => jellyfinAutoDeleteMock);
// services/tmdb.js is NOT mocked — only its side-effect-free METADATA_MAX_AGE_HOURS
// constant is imported, so the real module is fine to load as-is.

const {
    getRedis,
    getSyncQueue,
    isQueueHealthy,
    registerUserBackupJob,
    registerUserSyncJob,
    startScheduler,
    enqueueSyncNow,
} = await import("../jobs/scheduler.js");

type RowsResult = unknown[];

class SelectBuilder implements PromiseLike<RowsResult> {
    constructor(private readonly result: RowsResult) {}
    from() {
        return this;
    }
    where() {
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

class DeleteBuilder implements PromiseLike<undefined> {
    where() {
        return this;
    }
    then<T1 = undefined, T2 = never>(
        ok?: ((value: undefined) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    return {
        select: vi.fn(() => new SelectBuilder(state.selects.shift() ?? [])),
        delete: vi.fn(() => new DeleteBuilder()),
    };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SYNC_INTERVAL_MINUTES;
    queueInstance.upsertJobScheduler.mockResolvedValue(undefined);
    queueInstance.removeJobScheduler.mockResolvedValue(undefined);
    queueInstance.getRepeatableJobs.mockResolvedValue([]);
    queueInstance.removeRepeatableByKey.mockResolvedValue(undefined);
    syncMock.triggerIncrementalSync.mockResolvedValue(undefined);
    syncMock.resetStaleRunningSyncs.mockResolvedValue(undefined);
    backupMock.runScheduledBackup.mockResolvedValue(undefined);
    airingRemindersMock.runAiringReminders.mockResolvedValue({ sent: 0, pruned: 0 });
    jellyfinAutoDeleteMock.runJellyfinAutoDelete.mockResolvedValue({ deleted: 0, queued: 0 });
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
});

describe("getRedis / getSyncQueue singletons", () => {
    // `connection` is module-level state (not a vitest mock), so it's only ever
    // constructed once for the whole file — combined into one test rather than
    // split, since a second test calling getRedis() would just observe the
    // already-cached instance and never re-trigger the constructor/.on() call.
    it("constructs the IORedis client once, registers an error handler, and reuses it on subsequent calls", () => {
        const first = getRedis();
        expect(redisInstance.on).toHaveBeenCalledWith("error", expect.any(Function));

        const callsAfterFirst = IORedisMock.mock.calls.length;
        const second = getRedis();
        expect(second).toBe(first);
        expect(IORedisMock.mock.calls.length).toBe(callsAfterFirst);
    });

    it("constructs the Queue once and reuses it", () => {
        const first = getSyncQueue();
        const second = getSyncQueue();
        expect(first).toBe(second);
    });
});

describe("isQueueHealthy", () => {
    it("returns true when ping resolves PONG", async () => {
        redisInstance.ping.mockResolvedValue("PONG");
        expect(await isQueueHealthy()).toBe(true);
    });

    it("returns false when ping resolves something else", async () => {
        redisInstance.ping.mockResolvedValue("WRONG");
        expect(await isQueueHealthy()).toBe(false);
    });

    it("returns false (never throws) when ping rejects", async () => {
        redisInstance.ping.mockRejectedValue(new Error("connection refused"));
        expect(await isQueueHealthy()).toBe(false);
    });

    it("returns false when ping hangs past the 2s timeout", async () => {
        vi.useFakeTimers();
        redisInstance.ping.mockReturnValue(new Promise(() => {})); // never resolves
        const resultPromise = isQueueHealthy();
        await vi.advanceTimersByTimeAsync(2000);
        expect(await resultPromise).toBe(false);
    });
});

describe("registerUserBackupJob", () => {
    it("removes the scheduler (best-effort) instead of upserting when hours <= 0", async () => {
        dbMockState.db = createMockDb([[{ backupScheduleHours: 0 }]]);
        await registerUserBackupJob(1);
        expect(queueInstance.removeJobScheduler).toHaveBeenCalledWith("backup-user-1");
        expect(queueInstance.upsertJobScheduler).not.toHaveBeenCalled();
    });

    it("tolerates a failed removal when hours <= 0", async () => {
        dbMockState.db = createMockDb([[]]); // no row → hours defaults to 0
        queueInstance.removeJobScheduler.mockRejectedValue(new Error("not found"));
        await expect(registerUserBackupJob(1)).resolves.toBeUndefined();
    });

    it("upserts with the interval converted to milliseconds when hours > 0", async () => {
        dbMockState.db = createMockDb([[{ backupScheduleHours: 12 }]]);
        await registerUserBackupJob(1);
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "backup-user-1",
            { every: 12 * 60 * 60 * 1000 },
            expect.objectContaining({ name: "scheduled-backup", data: { userId: 1 } }),
        );
    });

    it("does not throw when the upsert itself fails", async () => {
        dbMockState.db = createMockDb([[{ backupScheduleHours: 12 }]]);
        queueInstance.upsertJobScheduler.mockRejectedValue(new Error("redis down"));
        await expect(registerUserBackupJob(1)).resolves.toBeUndefined();
    });
});

describe("registerUserSyncJob", () => {
    it("uses the user's configured syncIntervalMinutes", async () => {
        dbMockState.db = createMockDb([[{ syncIntervalMinutes: 30 }]]);
        await registerUserSyncJob(1);
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "sync-user-1",
            { every: 30 * 60 * 1000 },
            expect.objectContaining({ name: "incremental-sync", data: { userId: 1 } }),
        );
    });

    it("falls back to SYNC_INTERVAL_MINUTES when the DB lookup throws", async () => {
        process.env.SYNC_INTERVAL_MINUTES = "15";
        dbMockState.db = {
            select: vi.fn(() => {
                throw new Error("db down");
            }),
        };
        await registerUserSyncJob(1);
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "sync-user-1",
            { every: 15 * 60 * 1000 },
            expect.anything(),
        );
    });

    it("falls back to the default 60 minutes when nothing is configured", async () => {
        dbMockState.db = createMockDb([[]]);
        await registerUserSyncJob(1);
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "sync-user-1",
            { every: 60 * 60 * 1000 },
            expect.anything(),
        );
    });

    it("does not throw when the upsert itself fails", async () => {
        dbMockState.db = createMockDb([[{ syncIntervalMinutes: 30 }]]);
        queueInstance.upsertJobScheduler.mockRejectedValue(new Error("redis down"));
        await expect(registerUserSyncJob(1)).resolves.toBeUndefined();
    });
});

describe("enqueueSyncNow", () => {
    it("adds a deduped, high-priority job", async () => {
        await enqueueSyncNow(42);
        expect(queueInstance.add).toHaveBeenCalledWith(
            "incremental-sync",
            { userId: 42 },
            {
                jobId: "sync-now-42",
                priority: 1,
                removeOnComplete: true,
                removeOnFail: 5,
            },
        );
    });
});

describe("startScheduler", () => {
    it("resets stale running syncs before purging legacy repeatable jobs", async () => {
        const callOrder: string[] = [];
        syncMock.resetStaleRunningSyncs.mockImplementation(async () => {
            callOrder.push("reset");
        });
        queueInstance.getRepeatableJobs.mockImplementation(async () => {
            callOrder.push("purge");
            return [];
        });
        dbMockState.db = createMockDb([[]]); // no existing users to loop over

        await startScheduler();
        expect(callOrder).toEqual(["reset", "purge"]);
    });

    it("purges every legacy repeatable job returned by getRepeatableJobs", async () => {
        queueInstance.getRepeatableJobs.mockResolvedValue([
            { key: "legacy-1" },
            { key: "legacy-2" },
        ]);
        dbMockState.db = createMockDb([[]]);

        await startScheduler();
        expect(queueInstance.removeRepeatableByKey).toHaveBeenCalledWith("legacy-1");
        expect(queueInstance.removeRepeatableByKey).toHaveBeenCalledWith("legacy-2");
    });

    it("swallows a failure while listing legacy repeatable jobs", async () => {
        queueInstance.getRepeatableJobs.mockRejectedValue(new Error("redis down"));
        dbMockState.db = createMockDb([[]]);
        await expect(startScheduler()).resolves.toBeUndefined();
    });

    it("registers sync + backup jobs for every existing user", async () => {
        dbMockState.db = createMockDb([
            [{ id: 1 }, { id: 2 }], // db.select({id}).from(users)
            [{ syncIntervalMinutes: 30 }], // user 1: getUserSyncInterval
            [{ backupScheduleHours: 6 }], // user 1: registerUserBackupJob settings
            [{ syncIntervalMinutes: 45 }], // user 2: getUserSyncInterval
            [{ backupScheduleHours: 0 }], // user 2: registerUserBackupJob settings
        ]);

        await startScheduler();
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "sync-user-1",
            { every: 30 * 60 * 1000 },
            expect.anything(),
        );
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "sync-user-2",
            { every: 45 * 60 * 1000 },
            expect.anything(),
        );
        expect(queueInstance.upsertJobScheduler).toHaveBeenCalledWith(
            "backup-user-1",
            { every: 6 * 60 * 60 * 1000 },
            expect.anything(),
        );
        expect(queueInstance.removeJobScheduler).toHaveBeenCalledWith("backup-user-2");
    });

    it("registers the three daily cron jobs independently (one failing doesn't block the others)", async () => {
        dbMockState.db = createMockDb([[]]);
        queueInstance.upsertJobScheduler.mockImplementation(
            async (schedulerId: string, _repeat: unknown, opts: { name: string }) => {
                if (opts.name === "cleanup-cache") throw new Error("boom");
            },
        );

        await startScheduler();
        const patterns = queueInstance.upsertJobScheduler.mock.calls.map((c) => [c[0], c[1]]);
        expect(patterns).toContainEqual(["cleanup-metadata-cache", { pattern: "0 3 * * *" }]);
        expect(patterns).toContainEqual(["airing-reminders-daily", { pattern: "0 8 * * *" }]);
        expect(patterns).toContainEqual(["jellyfin-auto-delete-daily", { pattern: "0 4 * * *" }]);
    });

    describe("Worker job dispatch (captured processor callback)", () => {
        beforeEach(async () => {
            dbMockState.db = createMockDb([[]]);
            await startScheduler();
        });

        it("incremental-sync: triggers a sync for the given user", async () => {
            await workerCapture.processor!({ name: "incremental-sync", data: { userId: 7 } });
            expect(syncMock.triggerIncrementalSync).toHaveBeenCalledWith(7);
        });

        it("cleanup-cache: deletes metadata cache rows older than the max age (swallows its own errors)", async () => {
            const db = dbMockState.db as ReturnType<typeof createMockDb>;
            await workerCapture.processor!({ name: "cleanup-cache", data: {} });
            expect(db.delete).toHaveBeenCalledTimes(1);
        });

        it("airing-reminders: success is silent when nothing was sent/pruned", async () => {
            await expect(
                workerCapture.processor!({ name: "airing-reminders", data: {} }),
            ).resolves.toBeUndefined();
            expect(airingRemindersMock.runAiringReminders).toHaveBeenCalled();
        });

        it("airing-reminders: re-throws on failure so BullMQ can retry", async () => {
            airingRemindersMock.runAiringReminders.mockRejectedValue(new Error("boom"));
            await expect(
                workerCapture.processor!({ name: "airing-reminders", data: {} }),
            ).rejects.toThrow("boom");
        });

        it("scheduled-backup: failure is caught, not re-thrown", async () => {
            backupMock.runScheduledBackup.mockRejectedValue(new Error("backup failed"));
            await expect(
                workerCapture.processor!({ name: "scheduled-backup", data: { userId: 9 } }),
            ).resolves.toBeUndefined();
            expect(backupMock.runScheduledBackup).toHaveBeenCalledWith(9);
        });

        it("jellyfin-auto-delete: re-throws on failure so BullMQ can retry", async () => {
            jellyfinAutoDeleteMock.runJellyfinAutoDelete.mockRejectedValue(new Error("boom"));
            await expect(
                workerCapture.processor!({ name: "jellyfin-auto-delete", data: {} }),
            ).rejects.toThrow("boom");
        });
    });
});

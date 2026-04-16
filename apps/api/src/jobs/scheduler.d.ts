import { Queue } from "bullmq";
import IORedis from "ioredis";
export declare function getRedis(): IORedis;
export declare function getSyncQueue(): Queue<any, any, string, any, any, string>;
export declare function registerUserSyncJob(userId: number): Promise<void>;
export declare function startScheduler(): Promise<void>;
export declare function enqueueSyncNow(userId: number): Promise<void>;
//# sourceMappingURL=scheduler.d.ts.map
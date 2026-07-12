import { Hono } from "hono";
import { describe, expect, it } from "vitest";

const { systemRoutes } = await import("../routes/system.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.route("/system", systemRoutes);
    return a;
}

describe("GET /system/metrics", () => {
    it("reports live process and host metrics with a sane shape", async () => {
        const res = await app().request("/system/metrics");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: {
                process: Record<string, unknown>;
                system: Record<string, unknown>;
            };
        };
        const { process: proc, system } = body.data;
        expect(proc.heapUsed).toBeGreaterThan(0);
        expect(proc.heapTotal).toBeGreaterThan(0);
        expect(proc.rss).toBeGreaterThan(0);
        expect(proc.uptimeSeconds).toBeGreaterThanOrEqual(0);
        expect(typeof proc.nodeVersion).toBe("string");
        expect(system.totalMem).toBeGreaterThan(0);
        expect(system.usedMem).toBe(Number(system.totalMem) - Number(system.freeMem));
        expect(system.memPct).toBeGreaterThanOrEqual(0);
        expect(system.memPct).toBeLessThanOrEqual(100);
        expect(system.cpuCount).toBeGreaterThanOrEqual(1);
    });
});

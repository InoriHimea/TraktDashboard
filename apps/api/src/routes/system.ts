import { Hono } from "hono";
import os from "node:os";

export const systemRoutes = new Hono<{ Variables: { userId: number } }>();

// GET /api/system/metrics — server process + host metrics for the settings panel
systemRoutes.get("/metrics", (c) => {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    return c.json({
        data: {
            process: {
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                rss: mem.rss,
                uptimeSeconds: Math.floor(process.uptime()),
                nodeVersion: process.version,
                platform: process.platform,
            },
            system: {
                totalMem,
                freeMem,
                usedMem: totalMem - freeMem,
                memPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
                loadAvg1: loadAvg[0],
                cpuCount: os.cpus().length,
            },
        },
    });
});

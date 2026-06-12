import "./load-env.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { showRoutes } from "./routes/shows.js";
import { movieRoutes } from "./routes/movies.js";
import { syncRoutes } from "./routes/sync.js";
import { statsRoutes } from "./routes/stats.js";
import { settingsRoutes } from "./routes/settings.js";
import { imgRoutes } from "./routes/img.js";
import { traktRoutes } from "./routes/trakt.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { calendarRoutes } from "./routes/calendar.js";
import { historyRoutes } from "./routes/history.js";
import { authMiddleware } from "./middleware/auth.js";
import { startScheduler } from "./jobs/scheduler.js";

const app = new Hono();

app.use("*", logger());
app.use(
    "*",
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    }),
);

// Public routes
app.route("/auth", authRoutes);
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Protected routes
const api = new Hono();
api.use("*", authMiddleware);
api.route("/shows", showRoutes);
api.route("/movies", movieRoutes);
api.route("/sync", syncRoutes);
api.route("/stats", statsRoutes);
api.route("/settings", settingsRoutes);
api.route("/img", imgRoutes);
api.route("/trakt", traktRoutes);
api.route("/watchlist", watchlistRoutes);
api.route("/calendar", calendarRoutes);
api.route("/history", historyRoutes);

const routes = app.route("/api", api);

// Exported for the typed Hono RPC client (`hc<AppType>`) on the web side (P1-T12).
// NOTE: full RPC type inference additionally requires the individual route files to
// method-chain their handlers; that per-route migration is intentionally incremental.
export type AppType = typeof routes;

// 404
app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
});

const port = parseInt(process.env.API_PORT || "3001");

startScheduler().catch((err) => {
    console.error("[scheduler] Failed to start:", err);
});

console.log(`🚀 API running on http://localhost:${port}`);

export default {
    port,
    // `routes` is the same app instance with the `/api` mount captured in its type;
    // using it here (not `app`) keeps the binding a real value, not type-only.
    fetch: routes.fetch,
};

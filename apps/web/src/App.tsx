import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useAuth } from "./hooks";
import Layout from "./components/Layout";
import { t } from "./lib/i18n";

const TVShowsPage = React.lazy(() => import("./pages/TVShowsPage"));
const MoviesPage = React.lazy(() => import("./pages/MoviesPage"));
const MovieDetailPage = React.lazy(() => import("./pages/MovieDetailPage"));
const ShowDetailPage = React.lazy(() => import("./pages/ShowDetailPage"));
const EpisodeDetailPage = React.lazy(() => import("./pages/EpisodeDetailPage"));
const StatsPage = React.lazy(() => import("./pages/stats"));
const SyncPage = React.lazy(() => import("./pages/SyncPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const WatchlistPage = React.lazy(() => import("./pages/WatchlistPage"));
const CalendarPage = React.lazy(() => import("./pages/CalendarPage"));
const HistoryPage = React.lazy(() => import("./pages/HistoryPage"));
const DiscoverPage = React.lazy(() => import("./pages/DiscoverPage"));
const ListsPage = React.lazy(() => import("./pages/ListsPage"));

// Error Boundary component
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Error caught by boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
                    <div className="text-center flex flex-col items-center gap-6 max-w-md">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-950 to-red-900 border border-red-800/50 flex items-center justify-center shadow-lg shadow-red-950/50">
                            <AlertTriangle size={28} className="text-red-400" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-[var(--color-text-base)] text-xl font-semibold tracking-tight">
                                {t("app.error")}
                            </h2>
                            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                                {this.state.error?.message || "An unexpected error occurred"}
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer shadow-lg shadow-[var(--color-accent-glow)] hover:shadow-xl hover:shadow-[var(--color-accent-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            {t("app.refresh")}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

function RouteLoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
                <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>
            </div>
        </div>
    );
}

export default function App() {
    const { data: auth, isLoading, error } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
                    <p className="text-[var(--color-text-muted)] text-sm">Loading…</p>
                </div>
            </div>
        );
    }

    // Handle authentication error
    if (error && !auth?.authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-center flex flex-col items-center gap-6 max-w-md"
                >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-950 to-red-900 border border-red-800/50 flex items-center justify-center shadow-lg shadow-red-950/50">
                        <WifiOff size={28} className="text-red-400" />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-[var(--color-text-base)] text-xl font-semibold tracking-tight">
                            {t("app.connectionFailed")}
                        </h2>
                        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                            {t("app.authUnavailable")}
                        </p>
                    </div>
                    <motion.button
                        onClick={() => window.location.reload()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer shadow-lg shadow-[var(--color-accent-glow)] hover:shadow-xl hover:shadow-[var(--color-accent-glow)] transition-all"
                    >
                        {t("app.refresh")}
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (!auth?.authenticated) {
        return (
            <React.Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                    <Route path="*" element={<LoginPage />} />
                </Routes>
            </React.Suspense>
        );
    }

    return (
        <ErrorBoundary>
            <Routes>
                <Route
                    path="/*"
                    element={
                        <Layout>
                            <React.Suspense fallback={<RouteLoadingFallback />}>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/tv-shows" replace />} />
                                    <Route path="/tv-shows" element={<TVShowsPage />} />
                                    <Route
                                        path="/progress"
                                        element={<Navigate to="/tv-shows" replace />}
                                    />
                                    <Route path="/movies" element={<MoviesPage />} />
                                    <Route path="/movies/:id" element={<MovieDetailPage />} />
                                    <Route path="/discover" element={<DiscoverPage />} />
                                    <Route path="/lists" element={<ListsPage />} />
                                    <Route path="/shows/:id" element={<ShowDetailPage />} />
                                    <Route path="/calendar" element={<CalendarPage />} />
                                    <Route path="/watchlist" element={<WatchlistPage />} />
                                    <Route path="/history" element={<HistoryPage />} />
                                    <Route path="/stats" element={<StatsPage />} />
                                    <Route path="/sync" element={<SyncPage />} />
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="*" element={<Navigate to="/tv-shows" replace />} />
                                    <Route
                                        path="/shows/:showId/seasons/:season/episodes/:episode"
                                        element={<EpisodeDetailPage />}
                                    />
                                </Routes>
                            </React.Suspense>
                        </Layout>
                    }
                />
            </Routes>
        </ErrorBoundary>
    );
}

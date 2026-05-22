import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useAuth } from "./hooks";
import Layout from "./components/Layout";
import TVShowsPage from "./pages/TVShowsPage";
import MoviesPage from "./pages/MoviesPage";
import MovieDetailPage from "./pages/MovieDetailPage";
import ShowDetailPage from "./pages/ShowDetailPage";
import EpisodeDetailPage from "./pages/EpisodeDetailPage";
import StatsPage from "./pages/StatsPage";
import SyncPage from "./pages/SyncPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";

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
                                应用出错
                            </h2>
                            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                                {this.state.error?.message ||
                                    "An unexpected error occurred"}
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer shadow-lg shadow-[var(--color-accent-glow)] hover:shadow-xl hover:shadow-[var(--color-accent-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function App() {
    const { data: auth, isLoading, error } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
                    <p className="text-[var(--color-text-muted)] text-sm">
                        Loading…
                    </p>
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
                            连接失败
                        </h2>
                        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                            认证服务暂时不可用。请检查您的网络连接，然后刷新页面重试。
                        </p>
                    </div>
                    <motion.button
                        onClick={() => window.location.reload()}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer shadow-lg shadow-[var(--color-accent-glow)] hover:shadow-xl hover:shadow-[var(--color-accent-glow)] transition-all"
                    >
                        刷新页面
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (!auth?.authenticated) {
        return (
            <Routes>
                <Route path="*" element={<LoginPage />} />
            </Routes>
        );
    }

    return (
        <ErrorBoundary>
            <Routes>
                <Route
                    path="/*"
                    element={
                        <Layout>
                            <Routes>
                                <Route
                                    path="/"
                                    element={<Navigate to="/tv-shows" replace />}
                                />
                                <Route path="/tv-shows" element={<TVShowsPage />} />
                                <Route path="/progress" element={<Navigate to="/tv-shows" replace />} />
                                <Route path="/movies" element={<MoviesPage />} />
                                <Route path="/movies/:id" element={<MovieDetailPage />} />
                                <Route path="/shows/:id" element={<ShowDetailPage />} />
                                <Route path="/stats" element={<StatsPage />} />
                                <Route path="/sync" element={<SyncPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route
                                    path="*"
                                    element={<Navigate to="/tv-shows" replace />}
                                />
                                <Route
                                    path="/shows/:showId/seasons/:season/episodes/:episode"
                                    element={<EpisodeDetailPage />}
                                />
                            </Routes>
                        </Layout>
                    }
                />
            </Routes>
        </ErrorBoundary>
    );
}
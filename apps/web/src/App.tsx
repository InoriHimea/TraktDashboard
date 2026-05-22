import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
                <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
                    <div className="text-center flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-900 flex items-center justify-center">
                            <AlertTriangle size={24} color="var(--color-error)" />
                        </div>
                        <div>
                            <p className="text-[var(--color-error)] text-base font-semibold">
                                应用出错
                            </p>
                            <p className="text-[var(--color-text-muted)] text-sm mt-2 max-w-md">
                                {this.state.error?.message ||
                                    "An unexpected error occurred"}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-5 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity"
                            >
                                刷新页面
                            </button>
                        </div>
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
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
                <div className="text-center flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-900 flex items-center justify-center">
                        <WifiOff size={24} color="var(--color-error)" />
                    </div>
                    <div>
                        <p className="text-[var(--color-error)] text-base font-semibold">
                            连接失败
                        </p>
                        <p className="text-[var(--color-text-muted)] text-sm mt-2 max-w-md">
                            认证服务暂时不可用。请检查您的网络连接，然后刷新页面重试。
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-5 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
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
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
                <div
                    className="min-h-screen flex items-center justify-center"
                    style={{ background: "var(--color-bg)" }}
                >
                    <div
                        style={{
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "12px",
                                background: "#7f1d1d",
                                border: "1px solid #991b1b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                            }}
                        >
                            ⚠️
                        </div>
                        <div>
                            <p
                                style={{
                                    color: "var(--color-error)",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                }}
                            >
                                应用出错
                            </p>
                            <p
                                style={{
                                    color: "var(--color-text-muted)",
                                    fontSize: "14px",
                                    marginTop: "8px",
                                    maxWidth: "400px",
                                }}
                            >
                                {this.state.error?.message ||
                                    "An unexpected error occurred"}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    marginTop: "16px",
                                    padding: "10px 20px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--color-accent)",
                                    color: "#fff",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                }}
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
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ background: "var(--color-bg)" }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                        style={{
                            borderColor: "var(--color-accent)",
                            borderTopColor: "transparent",
                        }}
                    />
                    <p
                        style={{
                            color: "var(--color-text-muted)",
                            fontSize: "14px",
                        }}
                    >
                        Loading…
                    </p>
                </div>
            </div>
        );
    }

    // Handle authentication error
    if (error && !auth?.authenticated) {
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{ background: "var(--color-bg)" }}
            >
                <div
                    style={{
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "#7f1d1d",
                            border: "1px solid #991b1b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                        }}
                    >
                        🔌
                    </div>
                    <div>
                        <p
                            style={{
                                color: "var(--color-error)",
                                fontSize: "16px",
                                fontWeight: 600,
                            }}
                        >
                            连接失败
                        </p>
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                fontSize: "14px",
                                marginTop: "8px",
                                maxWidth: "400px",
                            }}
                        >
                            认证服务暂时不可用。请检查您的网络连接，然后刷新页面重试。
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: "16px",
                                padding: "10px 20px",
                                borderRadius: "var(--radius-md)",
                                background: "var(--color-accent)",
                                color: "#fff",
                                fontSize: "14px",
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                            }}
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
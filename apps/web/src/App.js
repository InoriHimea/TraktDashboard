import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks";
import Layout from "./components/Layout";
import ProgressPage from "./pages/ProgressPage";
import ShowDetailPage from "./pages/ShowDetailPage";
import EpisodeDetailPage from "./pages/EpisodeDetailPage";
import StatsPage from "./pages/StatsPage";
import SyncPage from "./pages/SyncPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
// Error Boundary component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Error caught by boundary:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center", style: { background: "var(--color-bg)" }, children: _jsxs("div", { style: {
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 16,
                    }, children: [_jsx("div", { style: {
                                width: "48px",
                                height: "48px",
                                borderRadius: "12px",
                                background: "#7f1d1d",
                                border: "1px solid #991b1b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "24px",
                            }, children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("p", { style: {
                                        color: "var(--color-error)",
                                        fontSize: "16px",
                                        fontWeight: 600,
                                    }, children: "\u5E94\u7528\u51FA\u9519" }), _jsx("p", { style: {
                                        color: "var(--color-text-muted)",
                                        fontSize: "14px",
                                        marginTop: "8px",
                                        maxWidth: "400px",
                                    }, children: this.state.error?.message ||
                                        "An unexpected error occurred" }), _jsx("button", { onClick: () => window.location.reload(), style: {
                                        marginTop: "16px",
                                        padding: "10px 20px",
                                        borderRadius: "var(--radius-md)",
                                        background: "var(--color-accent)",
                                        color: "#fff",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        border: "none",
                                        cursor: "pointer",
                                    }, children: "\u5237\u65B0\u9875\u9762" })] })] }) }));
        }
        return this.props.children;
    }
}
export default function App() {
    const { data: auth, isLoading, error } = useAuth();
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", style: { background: "var(--color-bg)" }, children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx("div", { className: "w-8 h-8 rounded-full border-2 border-t-transparent animate-spin", style: {
                            borderColor: "var(--color-accent)",
                            borderTopColor: "transparent",
                        } }), _jsx("p", { style: {
                            color: "var(--color-text-muted)",
                            fontSize: "14px",
                        }, children: "Loading\u2026" })] }) }));
    }
    // Handle authentication error
    if (error && !auth?.authenticated) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center", style: { background: "var(--color-bg)" }, children: _jsxs("div", { style: {
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                }, children: [_jsx("div", { style: {
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "#7f1d1d",
                            border: "1px solid #991b1b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                        }, children: "\uD83D\uDD0C" }), _jsxs("div", { children: [_jsx("p", { style: {
                                    color: "var(--color-error)",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                }, children: "\u8FDE\u63A5\u5931\u8D25" }), _jsx("p", { style: {
                                    color: "var(--color-text-muted)",
                                    fontSize: "14px",
                                    marginTop: "8px",
                                    maxWidth: "400px",
                                }, children: "\u8BA4\u8BC1\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\u3002\u8BF7\u68C0\u67E5\u60A8\u7684\u7F51\u7EDC\u8FDE\u63A5\uFF0C\u7136\u540E\u5237\u65B0\u9875\u9762\u91CD\u8BD5\u3002" }), _jsx("button", { onClick: () => window.location.reload(), style: {
                                    marginTop: "16px",
                                    padding: "10px 20px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--color-accent)",
                                    color: "#fff",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                }, children: "\u5237\u65B0\u9875\u9762" })] })] }) }));
    }
    if (!auth?.authenticated) {
        return (_jsx(Routes, { children: _jsx(Route, { path: "*", element: _jsx(LoginPage, {}) }) }));
    }
    return (_jsx(ErrorBoundary, { children: _jsx(Layout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/progress", replace: true }) }), _jsx(Route, { path: "/progress", element: _jsx(ProgressPage, {}) }), _jsx(Route, { path: "/shows/:id", element: _jsx(ShowDetailPage, {}) }), _jsx(Route, { path: "/shows/:showId/seasons/:season/episodes/:episode", element: _jsx(EpisodeDetailPage, {}) }), _jsx(Route, { path: "/stats", element: _jsx(StatsPage, {}) }), _jsx(Route, { path: "/sync", element: _jsx(SyncPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/progress", replace: true }) })] }) }) }));
}
//# sourceMappingURL=App.js.map
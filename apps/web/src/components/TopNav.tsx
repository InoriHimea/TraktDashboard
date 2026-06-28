import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGroup, motion } from "framer-motion";
import {
    BarChart3,
    Tv2,
    Film,
    Settings,
    LogOut,
    Bookmark,
    Calendar,
    Clock,
    Search,
    Compass,
    ListOrdered,
    Archive,
    Server,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNowPlaying, useJellyfinNowPlaying } from "../hooks/index";
import { NowPlayingPopup } from "./NowPlayingPopup";
import { SearchModal } from "./SearchModal";
import { t } from "../lib/i18n";

interface TopNavProps {
    username: string | null;
    onLogout: () => void;
}

const NAV = [
    { to: "/tv-shows", icon: Tv2, labelKey: "nav.tvShows" },
    { to: "/movies", icon: Film, labelKey: "nav.movies" },
    { to: "/discover", icon: Compass, labelKey: "nav.discover" },
    { to: "/lists", icon: ListOrdered, labelKey: "nav.lists" },
    { to: "/collection", icon: Archive, labelKey: "nav.collection" },
    { to: "/calendar", icon: Calendar, labelKey: "nav.calendar" },
    { to: "/watchlist", icon: Bookmark, labelKey: "nav.watchlist" },
    { to: "/history", icon: Clock, labelKey: "nav.history" },
    { to: "/stats", icon: BarChart3, labelKey: "nav.statistics" },
    { to: "/jellyfin", icon: Server, labelKey: "nav.jellyfin" },
    { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

function isNavActive(pathname: string, to: string) {
    if (to === "/tv-shows") {
        return (
            pathname === "/" || pathname.startsWith("/tv-shows") || pathname.startsWith("/shows/")
        );
    }
    if (to === "/movies") {
        return pathname.startsWith("/movies");
    }
    return pathname === to || pathname.startsWith(`${to}/`);
}

export default function TopNav({ username, onLogout }: TopNavProps) {
    const location = useLocation();
    const qc = useQueryClient();
    const { data: nowPlayingData, isWatching, isLoading: nowPlayingLoading } = useNowPlaying();
    const { data: jellyfinNowPlaying } = useJellyfinNowPlaying();
    const isJellyfinPlaying = !!jellyfinNowPlaying && !isWatching;
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const prevIsWatching = useRef(isWatching);

    // When a watching session ends (isWatching flips true → false), the user just
    // finished an episode. Invalidate stats and show/movie progress so the
    // "最近动态" section and progress lists refresh automatically.
    useEffect(() => {
        if (prevIsWatching.current && !isWatching) {
            qc.invalidateQueries({ queryKey: ["stats"] });
            qc.invalidateQueries({ queryKey: ["shows-progress"] });
            qc.invalidateQueries({ queryKey: ["movies-progress"] });
        }
        prevIsWatching.current = isWatching;
    }, [isWatching, qc]);

    return (
        <>
            <header
                className="top-nav-shell"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    height: "var(--app-nav-height)",
                    width: "100%",
                    maxWidth: "100vw",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    background:
                        "linear-gradient(180deg, var(--color-nav-glass), var(--color-surface))",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    boxShadow: "var(--shadow-nav)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                    gap: "8px",
                }}
            >
                {/* Logo */}
                <Link
                    to="/tv-shows"
                    style={{ textDecoration: "none", flexShrink: 0, marginRight: "8px" }}
                >
                    <span
                        className="top-nav-logo"
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "20px",
                            color: "var(--color-text)",
                            whiteSpace: "nowrap",
                            textShadow: "0 0 18px var(--color-accent-glow)",
                        }}
                    >
                        media<span style={{ color: "var(--color-accent)" }}>·</span>dash
                    </span>
                    {username && (
                        <span
                            style={{
                                fontSize: "11px",
                                color: "var(--color-text-muted)",
                                marginLeft: "6px",
                                display: "none",
                            }}
                            className="sm-show"
                        >
                            @{username}
                        </span>
                    )}
                </Link>

                {/* Nav items */}
                <nav
                    className="top-nav-items"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        flex: 1,
                        minWidth: 0,
                        overflowX: "auto",
                        scrollbarWidth: "none",
                    }}
                >
                    <LayoutGroup id="top-nav-active">
                        {NAV.map(({ to, icon: Icon, labelKey }) => {
                            const active = isNavActive(location.pathname, to);
                            return (
                                <Link
                                    key={to}
                                    to={to}
                                    aria-current={active ? "page" : undefined}
                                    className="top-nav-link halo"
                                    style={{
                                        textDecoration: "none",
                                        display: "inline-flex",
                                        borderRadius: "var(--radius-md)",
                                    }}
                                >
                                    <motion.div
                                        className="top-nav-item"
                                        animate={{
                                            backgroundColor: "rgba(0, 0, 0, 0)",
                                            borderColor: "rgba(0, 0, 0, 0)",
                                        }}
                                        whileHover={{
                                            backgroundColor: active
                                                ? "rgba(0, 0, 0, 0)"
                                                : "var(--color-nav-hover)",
                                            borderColor: active
                                                ? "rgba(0, 0, 0, 0)"
                                                : "var(--color-border-subtle)",
                                        }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "6px 12px",
                                            borderRadius: "var(--radius-md)",
                                            color: active
                                                ? "var(--color-accent-light)"
                                                : "var(--color-text-secondary)",
                                            border: "1px solid transparent",
                                            fontSize: "13px",
                                            fontWeight: active ? 650 : 500,
                                            position: "relative",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="topnav-active-frame"
                                                className="top-nav-active-frame"
                                                aria-hidden="true"
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 520,
                                                    damping: 42,
                                                    mass: 0.7,
                                                }}
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    borderRadius: "inherit",
                                                    background: "var(--color-nav-active-bg)",
                                                    border: "1px solid var(--color-nav-active-border)",
                                                    boxShadow:
                                                        "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 18px var(--color-accent-glow)",
                                                    zIndex: 0,
                                                }}
                                            />
                                        )}
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                position: "relative",
                                                zIndex: 1,
                                            }}
                                        >
                                            <Icon size={14} aria-hidden="true" />
                                            <span
                                                className="nav-label-full"
                                                style={{ display: "inline" }}
                                            >
                                                {t(labelKey)}
                                            </span>
                                        </span>
                                        {active && (
                                            <motion.div
                                                layoutId="topnav-indicator"
                                                className="top-nav-active-indicator"
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 520,
                                                    damping: 42,
                                                    mass: 0.7,
                                                }}
                                                style={{
                                                    position: "absolute",
                                                    bottom: "-1px",
                                                    left: "8px",
                                                    right: "8px",
                                                    height: "2px",
                                                    borderRadius: "2px 2px 0 0",
                                                    background:
                                                        "linear-gradient(90deg, transparent, var(--color-accent), var(--color-accent-rose), transparent)",
                                                    boxShadow: "0 0 14px var(--color-accent-glow)",
                                                    zIndex: 2,
                                                }}
                                            />
                                        )}
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </LayoutGroup>
                </nav>

                {/* Right: Search + Now Playing trigger + username + logout */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {/* Search button */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        title={t("search.openSearch")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 32,
                            height: 32,
                            borderRadius: "var(--radius-md)",
                            background: "transparent",
                            border: "1px solid var(--color-border-subtle)",
                            color: "var(--color-text-muted)",
                            cursor: "pointer",
                            transition: "background 0.15s, border-color 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--color-surface-3)";
                            e.currentTarget.style.color = "var(--color-text)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--color-text-muted)";
                        }}
                    >
                        <Search size={14} aria-hidden="true" />
                    </button>
                    {/* Now Playing trigger button — Trakt watching OR Jellyfin playing */}
                    {(isWatching || isJellyfinPlaying) && (
                        <button
                            ref={triggerRef}
                            data-testid="now-playing-trigger"
                            onClick={() => setIsPopupOpen((prev) => !prev)}
                            title={t("common.nowPlaying")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "5px 10px",
                                borderRadius: "var(--radius-md)",
                                background: isPopupOpen ? "var(--color-surface-3)" : "transparent",
                                border: isJellyfinPlaying
                                    ? "1px solid #06b6d4"
                                    : "1px solid var(--color-accent)",
                                color: isJellyfinPlaying ? "#06b6d4" : "var(--color-accent)",
                                boxShadow: isJellyfinPlaying
                                    ? "0 0 18px rgba(6,182,212,0.3)"
                                    : "0 0 18px var(--color-accent-glow)",
                                fontSize: "12px",
                                cursor: "pointer",
                                position: "relative",
                            }}
                        >
                            {/* Pulsing dot */}
                            <span
                                data-testid="now-playing-pulse"
                                style={{
                                    display: "inline-block",
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    background: isJellyfinPlaying
                                        ? "#06b6d4"
                                        : "var(--color-accent)",
                                    boxShadow: isJellyfinPlaying
                                        ? "0 0 10px #06b6d4"
                                        : "0 0 10px var(--color-accent)",
                                    animation: "pulse 1.5s ease-in-out infinite",
                                }}
                            />
                            <span>{t("common.nowPlaying")}</span>
                        </button>
                    )}

                    {username && (
                        <span
                            className="topnav-username"
                            style={{ fontSize: "12px", color: "var(--color-text-muted)" }}
                        >
                            @{username}
                        </span>
                    )}
                    <button
                        onClick={onLogout}
                        title={t("common.signOut")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-md)",
                            background: "transparent",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-muted)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                            fontSize: "12px",
                            cursor: "pointer",
                        }}
                    >
                        <LogOut size={13} aria-hidden="true" />
                        <span className="topnav-action-label" style={{ display: "inline" }}>
                            {t("common.signOut")}
                        </span>
                    </button>
                </div>
            </header>

            {/* Now Playing popup — rendered outside header to avoid stacking context issues */}
            <NowPlayingPopup
                data={nowPlayingData}
                jellyfinData={jellyfinNowPlaying}
                isLoading={nowPlayingLoading}
                isOpen={isPopupOpen && (isWatching || isJellyfinPlaying)}
                onClose={() => setIsPopupOpen(false)}
                triggerRef={triggerRef}
            />

            {/* Search modal */}
            {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
        </>
    );
}

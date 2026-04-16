import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Tv2, RefreshCw, Settings, LogOut } from 'lucide-react';
import { useNowPlaying } from '../hooks/index';
import { NowPlayingPopup } from './NowPlayingPopup';
const NAV = [
    { to: '/progress', icon: Tv2, label: 'Progress', short: 'Progress' },
    { to: '/stats', icon: BarChart3, label: 'Statistics', short: 'Stats' },
    { to: '/sync', icon: RefreshCw, label: 'Sync', short: 'Sync' },
    { to: '/settings', icon: Settings, label: 'Settings', short: 'Settings' },
];
export default function TopNav({ username, onLogout }) {
    const location = useLocation();
    const { data: nowPlayingData, isWatching, isLoading: nowPlayingLoading } = useNowPlaying();
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsxs("header", { style: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 40,
                    height: '56px',
                    background: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    gap: '8px',
                }, children: [_jsxs(Link, { to: "/progress", style: { textDecoration: 'none', flexShrink: 0, marginRight: '8px' }, children: [_jsxs("span", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '20px',
                                    color: 'var(--color-text)',
                                    letterSpacing: '-0.02em',
                                    whiteSpace: 'nowrap',
                                }, children: ["trakt", _jsx("span", { style: { color: 'var(--color-accent)' }, children: "\u00B7" }), "dash"] }), username && (_jsxs("span", { style: {
                                    fontSize: '11px',
                                    color: 'var(--color-text-muted)',
                                    marginLeft: '6px',
                                    display: 'none',
                                }, className: "sm-show", children: ["@", username] }))] }), _jsx("nav", { style: { display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }, children: NAV.map(({ to, icon: Icon, label }) => {
                            const active = location.pathname.startsWith(to);
                            return (_jsx(Link, { to: to, style: { textDecoration: 'none' }, children: _jsxs(motion.div, { whileHover: { backgroundColor: 'var(--color-surface-3)' }, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                        background: active ? 'var(--color-surface-3)' : 'transparent',
                                        fontSize: '13px',
                                        fontWeight: active ? 500 : 400,
                                        position: 'relative',
                                        whiteSpace: 'nowrap',
                                    }, children: [_jsx(Icon, { size: 14 }), _jsx("span", { className: "nav-label-full", style: { display: 'inline' }, children: label }), active && (_jsx(motion.div, { layoutId: "topnav-indicator", style: {
                                                position: 'absolute',
                                                bottom: '-1px',
                                                left: '8px',
                                                right: '8px',
                                                height: '2px',
                                                borderRadius: '2px 2px 0 0',
                                                background: 'var(--color-accent)',
                                            } }))] }) }, to));
                        }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }, children: [isWatching && (_jsxs("button", { "data-testid": "now-playing-trigger", onClick: () => setIsPopupOpen(prev => !prev), title: "Now Playing", style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    background: isPopupOpen ? 'var(--color-surface-3)' : 'transparent',
                                    border: '1px solid var(--color-accent)',
                                    color: 'var(--color-accent)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                }, children: [_jsx("span", { "data-testid": "now-playing-pulse", style: {
                                            display: 'inline-block',
                                            width: '7px',
                                            height: '7px',
                                            borderRadius: '50%',
                                            background: 'var(--color-accent)',
                                            animation: 'pulse 1.5s ease-in-out infinite',
                                        } }), _jsx("span", { children: "Now Playing" })] })), username && (_jsxs("span", { style: { fontSize: '12px', color: 'var(--color-text-muted)' }, children: ["@", username] })), _jsxs("button", { onClick: onLogout, title: "Sign out", style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'transparent',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }, children: [_jsx(LogOut, { size: 13 }), _jsx("span", { style: { display: 'inline' }, children: "Sign out" })] })] })] }), _jsx(NowPlayingPopup, { data: nowPlayingData, isLoading: nowPlayingLoading, isOpen: isPopupOpen && isWatching, onClose: () => setIsPopupOpen(false) })] }));
}
//# sourceMappingURL=TopNav.js.map
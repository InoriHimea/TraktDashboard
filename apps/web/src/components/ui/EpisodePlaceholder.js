import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Designed placeholder for missing episode stills.
 * Matches the dark immersive aesthetic — not a plain grey block.
 */
import { Film } from 'lucide-react';
// Deterministic gradient per episode for visual variety
const GRADIENTS = [
    'from-violet-950/80 to-slate-900',
    'from-cyan-950/80 to-slate-900',
    'from-indigo-950/80 to-slate-900',
    'from-purple-950/80 to-slate-900',
    'from-blue-950/80 to-slate-900',
    'from-teal-950/80 to-slate-900',
];
export function EpisodePlaceholder({ seasonNumber, episodeNumber, className = '' }) {
    const gradient = GRADIENTS[(seasonNumber + episodeNumber) % GRADIENTS.length];
    return (_jsxs("div", { className: `relative w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${className}`, children: [_jsx("div", { className: "absolute inset-0 opacity-[0.04]", style: {
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                } }), _jsx(Film, { size: 20, className: "text-white/20 relative z-10" }), _jsxs("span", { className: "text-[10px] font-mono text-white/20 relative z-10 tracking-widest", children: ["S", String(seasonNumber).padStart(2, '0'), "E", String(episodeNumber).padStart(2, '0')] })] }));
}
//# sourceMappingURL=EpisodePlaceholder.js.map
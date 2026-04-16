import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EpisodeGrid — 图2风格: 横向滚动的单集缩略图列表
 *
 * 每集: 16:9 缩略图 + 底部时长胶囊 + 已看对勾 + 标题 + S·E 标签
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MoreVertical } from 'lucide-react';
import { resolveEpisodeTitle } from '../lib/i18n';
import { resolveEpisodeStill } from '../lib/image';
import { EpisodePlaceholder } from './ui/EpisodePlaceholder';
export function EpisodeGrid({ episodes, seasonNumber, showId }) {
    return (_jsx(AnimatePresence, { mode: "wait", children: _jsx(motion.div, { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2 }, children: _jsx("div", { className: "flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1", style: { scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }, children: episodes.map((ep, i) => (_jsx(EpisodeThumbnail, { episode: ep, index: i, seasonNumber: seasonNumber, showId: showId }, ep.episodeId))) }) }, seasonNumber) }));
}
function EpisodeThumbnail({ episode, index, seasonNumber, showId }) {
    const navigate = useNavigate();
    const [imgError, setImgError] = useState(false);
    const title = resolveEpisodeTitle(episode);
    const stillUrl = resolveEpisodeStill(episode.stillPath);
    const showImg = stillUrl && !imgError;
    const isWatched = episode.watched;
    const isUnaired = episode.aired === false;
    const epCode = `S${String(seasonNumber).padStart(2, '0')} · E${String(episode.episodeNumber).padStart(2, '0')}`;
    const handleClick = () => {
        if (!isUnaired) {
            navigate(`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`);
        }
    };
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, delay: Math.min(index * 0.03, 0.35), ease: [0.16, 1, 0.3, 1] }, className: [
            'shrink-0 snap-start flex flex-col gap-2 group',
            isUnaired ? 'opacity-40 cursor-default' : 'cursor-pointer',
        ].join(' '), style: { width: '260px' }, onClick: handleClick, children: [_jsxs("div", { className: "relative w-full aspect-video rounded-md overflow-hidden bg-[var(--color-surface-3)]", children: [showImg ? (_jsx("img", { src: stillUrl, alt: title, className: "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105", loading: "lazy", onError: () => setImgError(true) })) : (_jsx(EpisodePlaceholder, { seasonNumber: seasonNumber, episodeNumber: episode.episodeNumber })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" }), episode.runtime && (_jsx("div", { className: "absolute bottom-1.5 left-1.5", children: _jsxs("span", { className: "text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm leading-none", children: [episode.runtime, "\u5206\u949F"] }) })), isWatched && (_jsx("div", { className: "absolute top-2 left-2", children: _jsx("div", { style: {
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'linear-gradient(145deg, #f472b6, #db2777)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(244,114,182,0.6), inset 0 1px 1px rgba(255,255,255,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }, children: _jsx(Check, { size: 14, strokeWidth: 3, className: "text-white" }) }) })), isUnaired && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: "text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/50", children: "\u672A\u64AD\u51FA" }) })), !isUnaired && (_jsx("button", { className: "absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white", "aria-label": "\u66F4\u591A\u9009\u9879", onClick: e => e.stopPropagation(), children: _jsx(MoreVertical, { size: 10 }) }))] }), _jsxs("div", { className: "flex flex-col gap-0.5 px-0.5", children: [_jsx("p", { className: [
                            'text-[12px] font-medium leading-snug line-clamp-2 transition-colors',
                            isWatched
                                ? 'text-[var(--color-text-muted)]'
                                : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]',
                        ].join(' '), children: title }), _jsx("span", { className: "text-[10px] text-[var(--color-text-muted)]", children: epCode })] })] }));
}
//# sourceMappingURL=EpisodeGrid.js.map
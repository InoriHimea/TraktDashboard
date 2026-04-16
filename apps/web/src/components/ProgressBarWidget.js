import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ProgressBarWidget — 覆盖在视频缩略图底部的宽扁进度胶囊
 *
 * 视觉: 深色毛玻璃宽胶囊，左侧时长标签 + 中间进度轨道 + 右侧剩余文字
 * 用法: absolute bottom-0 left-0 right-0，叠加在缩略图底部
 */
import { cn } from '../lib/utils';
// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtMinutes(min) {
    if (min < 60)
        return `${Math.round(min)}分钟`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `${h}小时` : `${h}小时${m}分`;
}
// ─── Component ────────────────────────────────────────────────────────────────
export function ProgressBarWidget({ totalMinutes, watchedMinutes, percentage, remainingEpisodes, watchedLabel, remainingLabel, className, }) {
    // 计算进度百分比
    const pct = (() => {
        if (watchedMinutes !== undefined && totalMinutes && totalMinutes > 0)
            return Math.min(100, Math.max(0, (watchedMinutes / totalMinutes) * 100));
        if (percentage !== undefined)
            return Math.min(100, Math.max(0, percentage));
        return 0;
    })();
    // 剩余时长
    const remainingMinutes = (() => {
        if (watchedMinutes !== undefined && totalMinutes !== undefined)
            return Math.max(0, totalMinutes - watchedMinutes);
        if (percentage !== undefined && totalMinutes !== undefined)
            return Math.max(0, totalMinutes * (1 - percentage / 100));
        return undefined;
    })();
    // 左侧标签
    const leftLabel = watchedLabel ?? (watchedMinutes !== undefined ? fmtMinutes(watchedMinutes) : `${Math.round(pct)}%`);
    // 右侧文字
    const rightLabel = remainingLabel ?? (() => {
        const parts = [];
        if (remainingEpisodes !== undefined && remainingEpisodes > 0)
            parts.push(`${remainingEpisodes} remaining`);
        if (remainingMinutes !== undefined && remainingMinutes > 0)
            parts.push(fmtMinutes(remainingMinutes));
        return parts.join(' · ');
    })();
    return (_jsxs("div", { className: cn(
        // 宽扁胶囊，占满宽度，毛玻璃深色背景
        'flex items-center gap-2 rounded-full', 'bg-black/75 backdrop-blur-md', 'px-2 py-1.5', className), role: "progressbar", "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `观看进度 ${Math.round(pct)}%`, children: [_jsx("span", { className: "shrink-0 rounded-full bg-black/60 text-white text-[11px] font-bold leading-none px-2.5 py-1 whitespace-nowrap", children: leftLabel }), _jsx("div", { className: "flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden min-w-0", children: _jsx("div", { className: "h-full rounded-full bg-white/60 transition-all duration-500", style: { width: `${pct}%` } }) }), rightLabel && (_jsx("span", { className: "shrink-0 text-white/70 text-[11px] font-semibold leading-none whitespace-nowrap", children: rightLabel }))] }));
}
export function InlineProgressBar({ percentage, trackHeight = 1, className, showPct = false, }) {
    const pct = Math.min(100, Math.max(0, percentage));
    return (_jsxs("div", { className: cn('flex items-center gap-2', className), children: [_jsx("div", { className: "relative flex-1 rounded-full overflow-hidden bg-white/10", style: { height: trackHeight }, children: _jsx("div", { className: "absolute inset-y-0 left-0 rounded-full bg-purple-500 transition-all duration-700", style: { width: `${pct}%` } }) }), showPct && (_jsxs("span", { className: "text-xs text-white/40 tabular-nums w-8 text-right shrink-0", children: [Math.round(pct), "%"] }))] }));
}
//# sourceMappingURL=ProgressBarWidget.js.map
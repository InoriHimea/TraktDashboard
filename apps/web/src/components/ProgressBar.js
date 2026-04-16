import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
export function ProgressBar({ watched, aired, total, compact = false, showLabel = true }) {
    const watchedPct = aired > 0 ? (watched / aired) * 100 : 0;
    const airedPct = total > 0 ? (aired / total) * 100 : 100;
    const unairedPct = 100 - airedPct;
    // Track height: compact = 2px pill, normal = 4px
    const trackH = compact ? '2px' : '4px';
    return (_jsxs("div", { className: "w-full", children: [showLabel && (_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("span", { style: { fontSize: '12px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }, children: [_jsx("span", { style: { color: 'var(--color-accent)', fontWeight: 600 }, children: watched }), _jsxs("span", { children: [" / ", aired, " \u5DF2\u64AD\u51FA"] }), unairedPct > 0 && total > aired && (_jsxs("span", { style: { color: 'var(--color-text-muted)', opacity: 0.6 }, children: [" \u00B7 ", total - aired, " \u672A\u64AD"] }))] }), _jsxs("span", { style: {
                            fontSize: '12px',
                            fontWeight: 600,
                            color: watchedPct >= 100 ? 'var(--color-watched)' : 'var(--color-accent)',
                            fontVariantNumeric: 'tabular-nums',
                        }, children: [Math.round(watchedPct), "%"] })] })), _jsxs("div", { className: cn('relative w-full overflow-hidden flex'), style: {
                    height: trackH,
                    borderRadius: '999px',
                    background: 'var(--color-surface-3)',
                }, children: [_jsx(motion.div, { style: {
                            height: '100%',
                            background: 'var(--color-accent)',
                            borderRadius: '999px 0 0 999px',
                            minWidth: watched > 0 ? '3px' : 0,
                        }, initial: { width: 0 }, animate: { width: `${(watched / Math.max(total, 1)) * 100}%` }, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }), _jsx(motion.div, { style: {
                            height: '100%',
                            background: 'var(--color-surface-4)',
                        }, initial: { width: 0 }, animate: { width: `${((aired - watched) / Math.max(total, 1)) * 100}%` }, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 } }), _jsx("div", { style: { flex: 1, height: '100%' } })] })] }));
}
//# sourceMappingURL=ProgressBar.js.map
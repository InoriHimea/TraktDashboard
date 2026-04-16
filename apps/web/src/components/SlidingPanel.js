import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
export function SlidingPanel({ open, onClose, children, title, width = '380px' }) {
    // Close on Escape key
    useEffect(() => {
        if (!open)
            return;
        const handleEscape = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);
    return (_jsx(AnimatePresence, { children: open && (_jsxs(_Fragment, { children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 }, className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-40", onClick: onClose }), _jsxs(motion.div, { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: { type: 'spring', damping: 30, stiffness: 300 }, className: "fixed top-0 right-0 bottom-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl", style: { width }, children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]", children: [_jsx("h2", { className: "text-lg font-semibold text-[var(--color-text)]", children: title }), _jsx("button", { onClick: onClose, className: "w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors", "aria-label": "\u5173\u95ED", children: _jsx(X, { size: 18 }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: children })] })] })) }));
}
//# sourceMappingURL=SlidingPanel.js.map
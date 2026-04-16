import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X } from 'lucide-react';
import { Button } from './ui/Button';
export function DateTimePickerModal({ open, onClose, onConfirm, defaultValue }) {
    const [dateTimeValue, setDateTimeValue] = useState('');
    useEffect(() => {
        if (open) {
            const date = defaultValue || new Date();
            // Format to datetime-local input format: YYYY-MM-DDTHH:mm
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            setDateTimeValue(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
    }, [open, defaultValue]);
    const handleConfirm = () => {
        if (!dateTimeValue)
            return;
        const date = new Date(dateTimeValue);
        onConfirm(date.toISOString());
    };
    // Close on Escape
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
    return (_jsx(AnimatePresence, { children: open && (_jsxs(_Fragment, { children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 }, className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center", onClick: onClose }), _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 10 }, transition: { duration: 0.2 }, className: "fixed z-50 bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-[420px] max-w-[90vw]", style: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]", children: [_jsx("h3", { className: "text-lg font-semibold text-[var(--color-text)]", children: "\u9009\u62E9\u89C2\u770B\u65F6\u95F4" }), _jsx("button", { onClick: onClose, className: "w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors", "aria-label": "\u5173\u95ED", children: _jsx(X, { size: 18 }) })] }), _jsx("div", { className: "p-6 space-y-4", children: _jsxs("div", { className: "relative", children: [_jsx("label", { className: "block text-sm font-medium text-[var(--color-text-secondary)] mb-2", children: "\u65E5\u671F\u548C\u65F6\u95F4" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none", children: _jsx(Calendar, { size: 16 }) }), _jsx("input", { type: "datetime-local", value: dateTimeValue, onChange: (e) => setDateTimeValue(e.target.value), className: "w-full pl-10 pr-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] transition-colors" })] })] }) }), _jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]", children: [_jsx(Button, { variant: "ghost", size: "md", onClick: onClose, children: "\u53D6\u6D88" }), _jsx(Button, { variant: "primary", size: "md", onClick: handleConfirm, disabled: !dateTimeValue, children: "\u6807\u8BB0\u4E3A\u5DF2\u89C2\u770B" })] })] })] })) }));
}
//# sourceMappingURL=DateTimePickerModal.js.map
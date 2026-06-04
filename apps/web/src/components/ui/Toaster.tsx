import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToast } from "../../lib/toast";
import type { ToastType } from "../../lib/toast";

const ICONS: Record<ToastType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
};

const COLORS: Record<ToastType, { border: string; icon: string }> = {
    success: { border: "rgba(49,245,168,0.28)", icon: "var(--color-watched)" },
    error: { border: "rgba(255,93,115,0.3)", icon: "var(--color-error)" },
    info: { border: "rgba(37,244,238,0.3)", icon: "var(--color-accent)" },
};

export function Toaster() {
    const { toasts, dismiss } = useToast();

    return (
        <div
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
            aria-label="Notifications"
        >
            <AnimatePresence initial={false}>
                {toasts.map((t) => {
                    const Icon = ICONS[t.type];
                    const { border, icon } = COLORS[t.type];
                    return (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 16, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[260px] max-w-[360px]"
                            style={{
                                background:
                                    "linear-gradient(180deg, rgba(141,252,255,0.055), transparent 42%), var(--color-panel-glass-strong)",
                                border: `1px solid ${border}`,
                                boxShadow: "var(--shadow-hud-glow)",
                                backdropFilter: "blur(14px)",
                                WebkitBackdropFilter: "blur(14px)",
                            }}
                            role="alert"
                        >
                            <Icon className="w-4 h-4 shrink-0" style={{ color: icon }} />
                            <div className="flex-1 flex items-center justify-between gap-3">
                                <span className="text-sm text-[var(--color-text)]">
                                    {t.message}
                                </span>
                                {t.action && (
                                    <button
                                        onClick={() => {
                                            t.action!.onClick();
                                            dismiss(t.id);
                                        }}
                                        className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-[var(--color-surface-3)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors"
                                    >
                                        {t.action.label}
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => dismiss(t.id)}
                                className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                                aria-label="Dismiss"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

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
    success: { border: "rgba(52,211,153,0.25)", icon: "#34d399" },
    error: { border: "rgba(239,68,68,0.25)", icon: "#ef4444" },
    info: { border: "rgba(124,106,247,0.25)", icon: "#7c6af7" },
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
                                background: "var(--color-surface)",
                                border: `1px solid ${border}`,
                            }}
                            role="alert"
                        >
                            <Icon className="w-4 h-4 shrink-0" style={{ color: icon }} />
                            <span className="flex-1 text-sm text-[var(--color-text)]">
                                {t.message}
                            </span>
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

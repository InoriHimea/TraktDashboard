import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button, type Color } from "./Button";

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: Color;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

const ICON_BADGE: Record<Color, string> = {
    cyan: "bg-cyan-300/15 text-cyan-200",
    violet: "bg-violet-500/20 text-violet-500",
    emerald: "bg-emerald-500/20 text-emerald-500",
    rose: "bg-rose-500/20 text-rose-500",
    amber: "bg-amber-500/20 text-amber-500",
    sky: "bg-sky-500/20 text-sky-500",
    slate: "bg-slate-500/20 text-slate-500",
};

export function ConfirmDialog({
    isOpen,
    title,
    description,
    confirmText = "确认",
    cancelText = "取消",
    confirmColor = "rose",
    onConfirm,
    onCancel,
    isLoading = false,
}: ConfirmDialogProps) {
    const isDanger = confirmColor === "rose";
    const buttonVariant = isDanger ? "danger" : "primary";

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={!isLoading ? onCancel : undefined}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="hud-panel-strong relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                    >
                        <div className="p-6">
                            <div className="mb-4 flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_BADGE[confirmColor]}`}
                                >
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                        <div className="flex items-center justify-end gap-3 bg-[var(--color-surface-2)] p-4">
                            <Button
                                variant="ghost"
                                color="slate"
                                onClick={onCancel}
                                disabled={isLoading}
                            >
                                {cancelText}
                            </Button>
                            <Button
                                variant={buttonVariant}
                                color={confirmColor}
                                onClick={onConfirm}
                                loading={isLoading}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

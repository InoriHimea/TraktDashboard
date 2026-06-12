import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: number;
    type: ToastType;
    message: string;
    action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (
        message: string,
        type?: ToastType,
        action?: { label: string; onClick: () => void },
    ) => void;
    dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: number) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        (
            message: string,
            type: ToastType = "info",
            action?: { label: string; onClick: () => void },
        ) => {
            const id = ++nextId;
            setToasts((prev) => [...prev, { id, type, message, action }]);
            const timer = setTimeout(() => dismiss(id), action ? 6000 : 3000);
            timers.current.set(id, timer);
        },
        [dismiss],
    );

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

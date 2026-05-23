import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: number;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (message: string, type?: ToastType) => void;
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
        (message: string, type: ToastType = "info") => {
            const id = ++nextId;
            setToasts((prev) => [...prev, { id, type, message }]);
            const timer = setTimeout(() => dismiss(id), 3000);
            timers.current.set(id, timer);
        },
        [dismiss],
    );

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

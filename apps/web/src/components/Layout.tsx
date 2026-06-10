import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./TopNav";
import { useAuth, useLogout, useSettings } from "../hooks";
import { ToastProvider } from "../lib/toast";
import { Toaster } from "./ui/Toaster";
import { setLocale } from "../lib/i18n";

export default function Layout({ children }: { children: ReactNode }) {
    const location = useLocation();
    const { data: auth } = useAuth();
    const { mutate: logout } = useLogout();
    const { data: settings } = useSettings();

    useEffect(() => {
        if (settings?.displayLanguage) {
            setLocale(settings.displayLanguage);
        }
    }, [settings?.displayLanguage]);

    return (
        <ToastProvider>
            <div
                className="flex flex-col flex-1 w-full"
                style={{
                    minHeight: "100svh",
                    background: "var(--color-bg)",
                    position: "relative",
                    overflowX: "clip",
                }}
            >
                <div className="cyber-grid-overlay" style={{ zIndex: 0 }} aria-hidden="true" />

                <div
                    className="flex flex-col flex-1 w-full"
                    style={{ position: "relative", zIndex: 1 }}
                >
                <TopNav
                    username={auth?.user?.traktUsername ?? null}
                    onLogout={() => logout()}
                />

                    <main
                        className="flex flex-col flex-1 w-full"
                        style={{
                            minHeight: "100svh",
                            paddingTop: "var(--app-nav-height)",
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18 }}
                                className="flex flex-col flex-1 w-full"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
                <Toaster />
            </div>
        </ToastProvider>
    );
}

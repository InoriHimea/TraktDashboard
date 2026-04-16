import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tv2, BarChart3, RefreshCw, CheckCircle2 } from "lucide-react";

const FEATURES = [
    {
        icon: Tv2,
        label: "Episode progress",
        desc: "Track every episode across all your shows",
    },
    {
        icon: BarChart3,
        label: "Watch statistics",
        desc: "Monthly activity, top genres, runtime",
    },
    {
        icon: RefreshCw,
        label: "Auto-sync",
        desc: "Incremental sync every 15 minutes",
    },
    {
        icon: CheckCircle2,
        label: "Completion tracking",
        desc: "Know exactly what you've finished",
    },
];

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        if (searchParams.get("auth") === "success") {
            navigate("/progress", { replace: true });
        }
    }, [searchParams, navigate]);

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: "var(--color-bg)" }}
        >
            {/* Ambient glow */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(ellipse 70% 60% at 50% 35%, var(--color-accent-glow) 0%, transparent 65%)",
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(ellipse 40% 30% at 20% 80%, #3b82f615 0%, transparent 60%)",
                }}
            />

            <div className="relative w-full max-w-4xl mx-auto px-6 py-16 flex flex-col lg:flex-row items-center gap-16">
                {/* Left — branding */}
                <motion.div
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-1 flex flex-col gap-8"
                >
                    <div>
                        <h1
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "64px",
                                color: "var(--color-text)",
                                letterSpacing: "-0.04em",
                                lineHeight: 0.95,
                            }}
                        >
                            trakt
                            <span style={{ color: "var(--color-accent)" }}>
                                ·
                            </span>
                            dash
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-secondary)",
                                fontSize: "17px",
                                marginTop: "16px",
                                lineHeight: 1.65,
                                maxWidth: "380px",
                            }}
                        >
                            Your personal TV progress tracker. Syncs with Trakt,
                            enriched with TMDB metadata.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="flex flex-col gap-3">
                        {FEATURES.map(({ icon: Icon, label, desc }, i) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.4,
                                    delay: 0.15 + i * 0.07,
                                }}
                                className="flex items-start gap-3"
                            >
                                <div
                                    className="shrink-0 flex items-center justify-center rounded-lg mt-0.5"
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                    }}
                                >
                                    <Icon
                                        size={15}
                                        style={{ color: "var(--color-accent)" }}
                                    />
                                </div>
                                <div>
                                    <p
                                        style={{
                                            fontSize: "14px",
                                            fontWeight: 500,
                                            color: "var(--color-text)",
                                        }}
                                    >
                                        {label}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                            marginTop: "1px",
                                        }}
                                    >
                                        {desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Right — login card */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.6,
                        delay: 0.1,
                        ease: [0.16, 1, 0.3, 1],
                    }}
                    className="w-full max-w-sm flex flex-col gap-6 rounded-2xl p-8"
                    style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        boxShadow:
                            "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,106,247,0.08)",
                    }}
                >
                    <div>
                        <h2
                            style={{
                                fontSize: "20px",
                                fontWeight: 600,
                                color: "var(--color-text)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Get started
                        </h2>
                        <p
                            style={{
                                fontSize: "13px",
                                color: "var(--color-text-secondary)",
                                marginTop: "6px",
                            }}
                        >
                            Connect your Trakt account to import your watch
                            history.
                        </p>
                    </div>

                    <motion.a
                        href="/auth/trakt"
                        whileHover={{
                            scale: 1.02,
                            boxShadow: "0 8px 24px var(--color-accent-glow)",
                        }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            padding: "13px 20px",
                            borderRadius: "var(--radius-lg)",
                            background: "var(--color-accent)",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                            textDecoration: "none",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {/* Trakt logo mark */}
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Connect with Trakt
                    </motion.a>

                    <div
                        className="rounded-xl p-4 flex flex-col gap-2"
                        style={{
                            background: "var(--color-surface-3)",
                            border: "1px solid var(--color-border-subtle)",
                        }}
                    >
                        {[
                            "Free Trakt account required",
                            "Data stored on your own server",
                            "No third-party sharing",
                        ].map((item) => (
                            <div key={item} className="flex items-center gap-2">
                                <CheckCircle2
                                    size={13}
                                    style={{
                                        color: "var(--color-watched)",
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

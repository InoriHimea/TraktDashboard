import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tv2, BarChart3, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";

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
            navigate("/tv-shows", { replace: true });
        }
    }, [searchParams, navigate]);

    return (
        <div
            className="min-h-screen min-h-svh flex items-center justify-center relative overflow-x-hidden"
            style={{
                background:
                    "radial-gradient(circle at 50% -10%, var(--color-accent-glow) 0%, transparent 36%), radial-gradient(circle at 8% 92%, rgba(59, 130, 246, 0.14) 0%, transparent 32%), var(--color-bg)",
                padding: "clamp(28px, 7vw, 72px) clamp(18px, 5vw, 40px)",
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(124,106,247,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,247,0.08) 1px, transparent 1px)",
                    backgroundSize: "64px 64px",
                    maskImage:
                        "radial-gradient(ellipse 70% 55% at 50% 45%, black 0%, transparent 75%)",
                }}
            />
            <div
                className="absolute top-10 right-[10%] h-48 w-48 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(124, 106, 247, 0.18)" }}
            />
            <div
                className="absolute bottom-8 left-[12%] h-40 w-40 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(52, 211, 153, 0.12)" }}
            />

            <div className="relative w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20">
                <motion.div
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full flex-1 flex flex-col items-center lg:items-start gap-6 sm:gap-8 text-center lg:text-left"
                >
                    <div
                        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2"
                        style={{
                            background: "rgba(124, 106, 247, 0.12)",
                            border: "1px solid rgba(124, 106, 247, 0.2)",
                            color: "var(--color-accent-light)",
                            fontSize: "12px",
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                        }}
                    >
                        <Sparkles size={14} />
                        Personal Trakt dashboard
                    </div>

                    <div>
                        <h1
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(42px, 11vw, 76px)",
                                color: "var(--color-text)",
                                letterSpacing: "-0.05em",
                                lineHeight: 0.9,
                                textShadow: "0 24px 80px rgba(124, 106, 247, 0.28)",
                            }}
                        >
                            trakt
                            <span style={{ color: "var(--color-accent)" }}>·</span>
                            dash
                        </h1>
                        <p
                            className="mx-auto lg:mx-0"
                            style={{
                                color: "var(--color-text-secondary)",
                                fontSize: "clamp(15px, 4vw, 18px)",
                                marginTop: "16px",
                                lineHeight: 1.65,
                                maxWidth: "440px",
                            }}
                        >
                            A polished home for your Trakt history, episode progress,
                            movie watches, and completion stats.
                        </p>
                    </div>

                    <div className="w-full max-w-md lg:max-w-lg grid gap-3 sm:grid-cols-2">
                        {FEATURES.map(({ icon: Icon, label, desc }, i) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                                className="rounded-2xl p-4 text-left"
                                style={{
                                    background: "rgba(255, 255, 255, 0.035)",
                                    border: "1px solid var(--color-border-subtle)",
                                    backdropFilter: "blur(18px)",
                                }}
                            >
                                <div
                                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                                    style={{
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                    }}
                                >
                                    <Icon size={17} style={{ color: "var(--color-accent)" }} />
                                </div>
                                <p
                                    style={{
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        color: "var(--color-text)",
                                    }}
                                >
                                    {label}
                                </p>
                                <p
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--color-text-muted)",
                                        marginTop: "4px",
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-[420px] rounded-[28px] p-1"
                    style={{
                        background:
                            "linear-gradient(145deg, rgba(124,106,247,0.35), rgba(255,255,255,0.08) 42%, rgba(52,211,153,0.16))",
                        boxShadow: "var(--shadow-login-card)",
                    }}
                >
                    <div
                        className="flex flex-col gap-6 rounded-[24px] p-6 sm:p-8"
                        style={{
                            background:
                                "linear-gradient(180deg, rgba(255,255,255,0.055), transparent 45%), var(--color-surface)",
                            border: "1px solid var(--color-border-subtle)",
                            backdropFilter: "blur(22px)",
                        }}
                    >
                        <div>
                            <div
                                className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                                style={{
                                    background: "var(--color-accent-dim)",
                                    border: "1px solid var(--color-accent-glow)",
                                }}
                            >
                                <Tv2 size={23} style={{ color: "var(--color-accent-light)" }} />
                            </div>
                            <h2
                                style={{
                                    fontSize: "24px",
                                    fontWeight: 700,
                                    color: "var(--color-text)",
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                Connect your library
                            </h2>
                            <p
                                style={{
                                    fontSize: "14px",
                                    color: "var(--color-text-secondary)",
                                    marginTop: "8px",
                                    lineHeight: 1.6,
                                }}
                            >
                                Sign in with Trakt to sync your shows, movies, watch
                                history, and progress.
                            </p>
                        </div>

                        <motion.a
                            href="/auth/trakt"
                            className="w-full flex items-center justify-center gap-3 rounded-2xl"
                            whileHover={{
                                scale: 1.015,
                                boxShadow: "var(--shadow-login-cta-hover)",
                            }}
                            whileTap={{ scale: 0.985 }}
                            style={{
                                minHeight: "60px",
                                padding: "18px 28px",
                                background:
                                    "linear-gradient(135deg, var(--color-accent), var(--color-accent-light))",
                                color: "#fff",
                                fontSize: "15px",
                                fontWeight: 700,
                                textDecoration: "none",
                                letterSpacing: "-0.01em",
                                boxShadow: "0 14px 34px rgba(124, 106, 247, 0.28)",
                            }}
                        >
                            <span
                                className="flex h-8 w-8 items-center justify-center rounded-xl"
                                style={{ background: "rgba(255,255,255,0.18)" }}
                            >
                                <svg
                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            </span>
                            Connect with Trakt
                        </motion.a>

                        <div
                            className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
                            style={{
                                background: "rgba(255, 255, 255, 0.035)",
                                border: "1px solid var(--color-border-subtle)",
                            }}
                        >
                            {[
                                "Free Trakt account required",
                                "Data stays on your own server",
                                "No third-party sharing",
                            ].map((item) => (
                                <div key={item} className="flex items-center gap-3">
                                    <CheckCircle2
                                        size={15}
                                        style={{
                                            color: "var(--color-watched)",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: "13px",
                                            color: "var(--color-text-secondary)",
                                        }}
                                    >
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

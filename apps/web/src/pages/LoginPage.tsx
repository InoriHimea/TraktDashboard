import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, CheckCircle2, RefreshCw, ShieldCheck, Sparkles, Tv2 } from "lucide-react";

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
                    "radial-gradient(circle at 50% -12%, var(--color-accent-glow) 0%, transparent 34%), radial-gradient(circle at 8% 92%, rgba(52, 211, 153, 0.11) 0%, transparent 30%), var(--color-bg)",
                padding: "clamp(32px, 7vw, 76px) clamp(20px, 5vw, 48px)",
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(255,255,255,0.025), transparent 42%)",
                }}
            />

            <div
                className="relative w-full mx-auto grid items-center"
                style={{
                    maxWidth: "1040px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                    gap: "clamp(32px, 7vw, 72px)",
                }}
            >
                <motion.section
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col"
                    style={{ gap: "28px" }}
                >
                    <div
                        className="inline-flex items-center"
                        style={{
                            width: "fit-content",
                            gap: "8px",
                            padding: "9px 14px",
                            borderRadius: "999px",
                            background: "rgba(124, 106, 247, 0.12)",
                            border: "1px solid rgba(124, 106, 247, 0.2)",
                            color: "var(--color-accent-light)",
                            fontSize: "12px",
                            fontWeight: 700,
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
                                fontSize: "clamp(46px, 10vw, 76px)",
                                color: "var(--color-text)",
                                letterSpacing: "-0.055em",
                                lineHeight: 0.92,
                                textShadow: "0 22px 70px rgba(124, 106, 247, 0.24)",
                            }}
                        >
                            trakt
                            <span style={{ color: "var(--color-accent)" }}>·</span>
                            dash
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-secondary)",
                                fontSize: "clamp(15px, 3.5vw, 18px)",
                                marginTop: "18px",
                                lineHeight: 1.7,
                                maxWidth: "470px",
                            }}
                        >
                            A clean home for your Trakt history, episode progress, movie
                            watches, and completion stats.
                        </p>
                    </div>

                    <div className="grid" style={{ gap: "12px", maxWidth: "500px" }}>
                        {FEATURES.map(({ icon: Icon, label, desc }, i) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: 0.12 + i * 0.06 }}
                                className="flex items-start"
                                style={{
                                    gap: "14px",
                                    padding: "16px 18px",
                                    borderRadius: "20px",
                                    background: "rgba(255, 255, 255, 0.04)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        width: "38px",
                                        height: "38px",
                                        flexShrink: 0,
                                        borderRadius: "14px",
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                    }}
                                >
                                    <Icon size={17} style={{ color: "var(--color-accent)" }} />
                                </div>
                                <div style={{ paddingTop: "1px" }}>
                                    <p
                                        style={{
                                            fontSize: "14px",
                                            fontWeight: 700,
                                            color: "var(--color-text)",
                                        }}
                                    >
                                        {label}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                            marginTop: "5px",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full"
                    style={{ maxWidth: "440px", justifySelf: "center" }}
                >
                    <div
                        style={{
                            padding: "2px",
                            borderRadius: "32px",
                            background:
                                "linear-gradient(145deg, rgba(124,106,247,0.42), rgba(255,255,255,0.1) 44%, rgba(52,211,153,0.2))",
                            boxShadow: "var(--shadow-login-card)",
                        }}
                    >
                        <div
                            className="flex flex-col"
                            style={{
                                gap: "26px",
                                padding: "clamp(28px, 5vw, 40px)",
                                borderRadius: "30px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border-subtle)",
                            }}
                        >
                            <div className="flex items-start" style={{ gap: "16px" }}>
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        width: "54px",
                                        height: "54px",
                                        flexShrink: 0,
                                        borderRadius: "20px",
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                    }}
                                >
                                    <ShieldCheck
                                        size={25}
                                        style={{ color: "var(--color-accent-light)" }}
                                    />
                                </div>
                                <div>
                                    <h2
                                        style={{
                                            fontSize: "25px",
                                            fontWeight: 800,
                                            color: "var(--color-text)",
                                            letterSpacing: "-0.035em",
                                        }}
                                    >
                                        Connect your library
                                    </h2>
                                    <p
                                        style={{
                                            fontSize: "14px",
                                            color: "var(--color-text-secondary)",
                                            marginTop: "8px",
                                            lineHeight: 1.65,
                                        }}
                                    >
                                        Sign in with Trakt to import your shows, movies, and
                                        watch history.
                                    </p>
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "18px",
                                    borderRadius: "26px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <motion.a
                                    href="/auth/trakt"
                                    className="flex items-center justify-center"
                                    whileHover={{
                                        scale: 1.01,
                                        boxShadow: "var(--shadow-login-cta-hover)",
                                    }}
                                    whileTap={{ scale: 0.985 }}
                                    style={{
                                        gap: "12px",
                                        minHeight: "72px",
                                        width: "100%",
                                        padding: "24px 34px",
                                        borderRadius: "20px",
                                        background:
                                            "linear-gradient(135deg, var(--color-accent), var(--color-accent-light))",
                                        color: "#fff",
                                        fontSize: "16px",
                                        fontWeight: 800,
                                        textDecoration: "none",
                                        letterSpacing: "-0.015em",
                                        boxShadow: "0 18px 38px rgba(124, 106, 247, 0.3)",
                                    }}
                                >
                                    <span
                                        className="flex items-center justify-center"
                                        style={{
                                            width: "34px",
                                            height: "34px",
                                            borderRadius: "13px",
                                            background: "rgba(255,255,255,0.2)",
                                            flexShrink: 0,
                                        }}
                                    >
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
                                    </span>
                                    Connect with Trakt
                                </motion.a>
                            </div>

                            <div
                                className="flex flex-col"
                                style={{
                                    gap: "12px",
                                    padding: "20px",
                                    borderRadius: "22px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                {[
                                    "Free Trakt account required",
                                    "Data stays on your own server",
                                    "No third-party sharing",
                                ].map((item) => (
                                    <div key={item} className="flex items-center" style={{ gap: "12px" }}>
                                        <CheckCircle2
                                            size={16}
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
                    </div>
                </motion.section>
            </div>
        </div>
    );
}

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    BarChart3,
    CheckCircle2,
    Clock3,
    Film,
    Play,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Tv2,
} from "lucide-react";

const FEATURES = [
    {
        icon: Tv2,
        label: "Episode progress",
        desc: "Track seasons, next episodes, and completion at a glance.",
    },
    {
        icon: Film,
        label: "Movies library",
        desc: "Keep movie watches and replays beside your shows.",
    },
    {
        icon: RefreshCw,
        label: "Auto-sync",
        desc: "Bring your Trakt history home with scheduled imports.",
    },
];

const METRICS = [
    { label: "Shows", value: "128" },
    { label: "Movies", value: "342" },
    { label: "Hours", value: "1.8k" },
];

const TRUST_ITEMS = [
    "Free Trakt account required",
    "Data stays on your own server",
    "No third-party sharing",
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
            className="min-h-screen min-h-svh relative overflow-x-hidden"
            style={{
                background:
                    "radial-gradient(circle at 18% 14%, rgba(124,106,247,0.28) 0%, transparent 30%), radial-gradient(circle at 86% 8%, rgba(52,211,153,0.16) 0%, transparent 24%), radial-gradient(circle at 50% 108%, rgba(124,106,247,0.2) 0%, transparent 35%), var(--color-bg)",
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "linear-gradient(135deg, rgba(255,255,255,0.045), transparent 28%, rgba(255,255,255,0.025) 64%, transparent)",
                    maskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.96), rgba(0,0,0,0.78), rgba(0,0,0,0.96))",
                }}
            />
            <div
                className="absolute pointer-events-none"
                style={{
                    top: "10%",
                    right: "9%",
                    width: "260px",
                    height: "260px",
                    borderRadius: "999px",
                    background: "var(--color-accent-glow)",
                    filter: "blur(96px)",
                    opacity: 0.65,
                }}
            />

            <main
                className="relative grid min-h-screen min-h-svh w-full items-center justify-center"
                style={{
                    maxWidth: "1180px",
                    margin: "0 auto",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
                    justifyItems: "center",
                    gap: "clamp(34px, 7vw, 88px)",
                    padding: "clamp(32px, 7vw, 84px) clamp(20px, 5vw, 52px)",
                }}
            >
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col"
                    style={{ gap: "30px" }}
                >
                    <div
                        className="inline-flex items-center"
                        style={{
                            width: "fit-content",
                            gap: "9px",
                            padding: "10px 14px",
                            borderRadius: "999px",
                            background: "rgba(124, 106, 247, 0.12)",
                            border: "1px solid rgba(124, 106, 247, 0.22)",
                            color: "var(--color-accent-light)",
                            fontSize: "12px",
                            fontWeight: 750,
                            letterSpacing: "0.025em",
                            boxShadow: "0 12px 34px rgba(124, 106, 247, 0.12)",
                            backdropFilter: "blur(18px)",
                        }}
                    >
                        <Sparkles size={14} />
                        Personal media command center
                    </div>

                    <div>
                        <h1
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(54px, 11vw, 92px)",
                                color: "var(--color-text)",
                                letterSpacing: "-0.06em",
                                lineHeight: 0.88,
                                textShadow: "0 28px 90px rgba(124, 106, 247, 0.26)",
                            }}
                        >
                            trakt
                            <span style={{ color: "var(--color-accent)" }}>·</span>
                            dash
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-secondary)",
                                fontSize: "clamp(16px, 2.8vw, 19px)",
                                marginTop: "22px",
                                lineHeight: 1.75,
                                maxWidth: "560px",
                            }}
                        >
                            A polished private dashboard for your Trakt history, TV progress,
                            movie watches, and completion insights.
                        </p>
                    </div>

                    <div className="grid grid-cols-3" style={{ gap: "12px", maxWidth: "520px" }}>
                        {METRICS.map((metric, index) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 + index * 0.06 }}
                                style={{
                                    padding: "18px 16px",
                                    borderRadius: "22px",
                                    background: "rgba(255, 255, 255, 0.045)",
                                    border: "1px solid var(--color-border-subtle)",
                                    backdropFilter: "blur(18px)",
                                }}
                            >
                                <div
                                    style={{
                                        color: "var(--color-text)",
                                        fontSize: "24px",
                                        fontWeight: 850,
                                        letterSpacing: "-0.04em",
                                    }}
                                >
                                    {metric.value}
                                </div>
                                <div
                                    style={{
                                        color: "var(--color-text-muted)",
                                        fontSize: "12px",
                                        marginTop: "5px",
                                        fontWeight: 650,
                                    }}
                                >
                                    {metric.label}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="grid" style={{ gap: "12px", maxWidth: "580px" }}>
                        {FEATURES.map(({ icon: Icon, label, desc }, index) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, x: -14 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: 0.18 + index * 0.06 }}
                                className="flex items-center"
                                style={{
                                    gap: "15px",
                                    padding: "15px 16px",
                                    borderRadius: "22px",
                                    background: "rgba(255, 255, 255, 0.035)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        width: "42px",
                                        height: "42px",
                                        flexShrink: 0,
                                        borderRadius: "16px",
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                        color: "var(--color-accent-light)",
                                    }}
                                >
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p
                                        style={{
                                            color: "var(--color-text)",
                                            fontSize: "14px",
                                            fontWeight: 800,
                                            letterSpacing: "-0.015em",
                                        }}
                                    >
                                        {label}
                                    </p>
                                    <p
                                        style={{
                                            color: "var(--color-text-secondary)",
                                            fontSize: "12px",
                                            lineHeight: 1.55,
                                            marginTop: "4px",
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
                    initial={{ opacity: 0, y: 22, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.62, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-full"
                    style={{ maxWidth: "500px", justifySelf: "center" }}
                >
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            inset: "28px -18px -24px 28px",
                            borderRadius: "36px",
                            background: "rgba(124, 106, 247, 0.12)",
                            filter: "blur(34px)",
                        }}
                    />

                    <div
                        className="relative"
                        style={{
                            padding: "1px",
                            borderRadius: "36px",
                            background:
                                "linear-gradient(145deg, rgba(124,106,247,0.58), rgba(255,255,255,0.13) 45%, rgba(52,211,153,0.32))",
                            boxShadow: "var(--shadow-login-card)",
                        }}
                    >
                        <div
                            className="flex flex-col"
                            style={{
                                gap: "22px",
                                padding: "clamp(22px, 4.6vw, 34px)",
                                borderRadius: "35px",
                                background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.035), transparent 36%), var(--color-surface)",
                                border: "1px solid var(--color-border-subtle)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    padding: "18px",
                                    borderRadius: "28px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <div
                                    className="flex items-center justify-between"
                                    style={{ gap: "16px", marginBottom: "22px" }}
                                >
                                    <div
                                        className="inline-flex items-center"
                                        style={{
                                            gap: "8px",
                                            color: "var(--color-text-secondary)",
                                            fontSize: "12px",
                                            fontWeight: 750,
                                        }}
                                    >
                                        <BarChart3 size={15} style={{ color: "var(--color-accent)" }} />
                                        Watch overview
                                    </div>
                                    <div
                                        className="inline-flex items-center"
                                        style={{
                                            gap: "6px",
                                            padding: "7px 10px",
                                            borderRadius: "999px",
                                            background: "rgba(52, 211, 153, 0.1)",
                                            color: "var(--color-watched)",
                                            fontSize: "11px",
                                            fontWeight: 800,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: "6px",
                                                height: "6px",
                                                borderRadius: "999px",
                                                background: "var(--color-watched)",
                                            }}
                                        />
                                        Synced
                                    </div>
                                </div>

                                <div className="grid grid-cols-3" style={{ gap: "9px" }}>
                                    {[78, 54, 91].map((height, index) => (
                                        <div
                                            key={height}
                                            className="flex items-end justify-center"
                                            style={{
                                                height: "92px",
                                                borderRadius: "18px",
                                                background: "rgba(255,255,255,0.035)",
                                                border: "1px solid var(--color-border-subtle)",
                                                padding: "8px",
                                            }}
                                        >
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height }}
                                                transition={{
                                                    duration: 0.65,
                                                    delay: 0.22 + index * 0.08,
                                                    ease: [0.16, 1, 0.3, 1],
                                                }}
                                                style={{
                                                    width: "100%",
                                                    borderRadius: "12px",
                                                    background:
                                                        index === 1
                                                            ? "linear-gradient(180deg, var(--color-watched), rgba(52,211,153,0.28))"
                                                            : "linear-gradient(180deg, var(--color-accent-light), rgba(124,106,247,0.28))",
                                                    boxShadow: "0 12px 26px rgba(124,106,247,0.2)",
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="grid" style={{ gap: "10px", marginTop: "16px" }}>
                                    {[
                                        ["The Last of Us", "S02 · Next episode", "72%"],
                                        ["Dune: Part Two", "Movie replay", "Watched"],
                                    ].map(([title, subtitle, status]) => (
                                        <div
                                            key={title}
                                            className="flex items-center justify-between"
                                            style={{
                                                gap: "14px",
                                                padding: "12px",
                                                borderRadius: "18px",
                                                background: "rgba(255,255,255,0.035)",
                                            }}
                                        >
                                            <div className="flex items-center" style={{ gap: "10px" }}>
                                                <div
                                                    className="flex items-center justify-center"
                                                    style={{
                                                        width: "34px",
                                                        height: "34px",
                                                        borderRadius: "13px",
                                                        background: "var(--color-accent-dim)",
                                                        color: "var(--color-accent-light)",
                                                    }}
                                                >
                                                    {status === "Watched" ? <Film size={15} /> : <Clock3 size={15} />}
                                                </div>
                                                <div>
                                                    <p
                                                        style={{
                                                            color: "var(--color-text)",
                                                            fontSize: "13px",
                                                            fontWeight: 800,
                                                        }}
                                                    >
                                                        {title}
                                                    </p>
                                                    <p
                                                        style={{
                                                            color: "var(--color-text-muted)",
                                                            fontSize: "11px",
                                                            marginTop: "3px",
                                                        }}
                                                    >
                                                        {subtitle}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                style={{
                                                    color:
                                                        status === "Watched"
                                                            ? "var(--color-watched)"
                                                            : "var(--color-accent-light)",
                                                    fontSize: "11px",
                                                    fontWeight: 850,
                                                }}
                                            >
                                                {status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-start" style={{ gap: "15px" }}>
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        width: "52px",
                                        height: "52px",
                                        flexShrink: 0,
                                        borderRadius: "20px",
                                        background: "var(--color-accent-dim)",
                                        border: "1px solid var(--color-accent-glow)",
                                        color: "var(--color-accent-light)",
                                    }}
                                >
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h2
                                        style={{
                                            color: "var(--color-text)",
                                            fontSize: "24px",
                                            fontWeight: 850,
                                            letterSpacing: "-0.04em",
                                        }}
                                    >
                                        Connect your library
                                    </h2>
                                    <p
                                        style={{
                                            color: "var(--color-text-secondary)",
                                            fontSize: "14px",
                                            lineHeight: 1.65,
                                            marginTop: "7px",
                                        }}
                                    >
                                        Sign in with Trakt to import shows, movies, and watch history
                                        into your private dashboard.
                                    </p>
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "16px",
                                    borderRadius: "28px",
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <motion.a
                                    href="/auth/trakt"
                                    className="flex items-center justify-center"
                                    whileHover={{
                                        y: -1,
                                        scale: 1.01,
                                        boxShadow: "var(--shadow-login-cta-hover)",
                                    }}
                                    whileTap={{ scale: 0.985 }}
                                    style={{
                                        gap: "12px",
                                        minHeight: "72px",
                                        width: "100%",
                                        padding: "24px 34px",
                                        borderRadius: "22px",
                                        background:
                                            "linear-gradient(135deg, var(--color-accent), var(--color-accent-light))",
                                        color: "#fff",
                                        fontSize: "16px",
                                        fontWeight: 850,
                                        textDecoration: "none",
                                        letterSpacing: "-0.015em",
                                        boxShadow: "0 18px 42px rgba(124, 106, 247, 0.32)",
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
                                        <Play size={17} fill="currentColor" strokeWidth={2.4} />
                                    </span>
                                    Connect with Trakt
                                </motion.a>
                            </div>

                            <div className="grid" style={{ gap: "11px" }}>
                                {TRUST_ITEMS.map((item) => (
                                    <div key={item} className="flex items-center" style={{ gap: "11px" }}>
                                        <CheckCircle2
                                            size={16}
                                            style={{ color: "var(--color-watched)", flexShrink: 0 }}
                                        />
                                        <span
                                            style={{
                                                color: "var(--color-text-secondary)",
                                                fontSize: "13px",
                                                lineHeight: 1.45,
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
            </main>
        </div>
    );
}

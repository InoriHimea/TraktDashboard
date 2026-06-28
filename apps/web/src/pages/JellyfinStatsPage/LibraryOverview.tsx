import { Film, Tv2, PlaySquare, Server } from "lucide-react";
import type { JellyfinLibrarySummary } from "@trakt-dashboard/types";
import { CARD_BG, CARD_BDR, T1, T2, T3, COLORS } from "../stats/tokens";
import { t } from "../../lib/i18n";

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: (typeof COLORS)[keyof typeof COLORS];
}

function StatCard({ icon, label, value, color }: StatCardProps) {
    return (
        <div
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "20px",
                backdropFilter: "blur(24px)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: "1 1 160px",
                minWidth: 0,
            }}
        >
            <div
                style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: color.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: color.light,
                }}
            >
                {icon}
            </div>
            <div>
                <div
                    style={{
                        fontSize: "26px",
                        fontWeight: 700,
                        color: T1,
                        letterSpacing: "-0.04em",
                    }}
                >
                    {Number(value).toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: T3, marginTop: "3px" }}>{label}</div>
            </div>
        </div>
    );
}

interface Props {
    data: JellyfinLibrarySummary | null | undefined;
    isLoading: boolean;
}

export function LibraryOverview({ data, isLoading }: Props) {
    if (isLoading) {
        return (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        style={{
                            background: CARD_BG,
                            border: CARD_BDR,
                            borderRadius: "20px",
                            height: "112px",
                            flex: "1 1 160px",
                            minWidth: 0,
                            opacity: 0.5,
                            animation: "pulse 1.5s infinite",
                        }}
                    />
                ))}
            </div>
        );
    }

    const cards = [
        {
            icon: <Film size={18} />,
            label: t("jellyfinStats.movies"),
            value: data?.movieCount ?? 0,
            color: COLORS.violet,
        },
        {
            icon: <Tv2 size={18} />,
            label: t("jellyfinStats.series"),
            value: data?.seriesCount ?? 0,
            color: COLORS.sky,
        },
        {
            icon: <PlaySquare size={18} />,
            label: t("jellyfinStats.episodes"),
            value: data?.episodeCount ?? 0,
            color: COLORS.emerald,
        },
    ];

    return (
        <div>
            <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}
            >
                <Server size={14} color={T2} />
                <span
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: T2,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("jellyfinStats.libraryOverview")}
                </span>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {cards.map((card) => (
                    <StatCard key={card.label} {...card} />
                ))}
            </div>
        </div>
    );
}

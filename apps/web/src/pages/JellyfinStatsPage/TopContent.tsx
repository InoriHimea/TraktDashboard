import { Trophy, Film, Tv2 } from "lucide-react";
import type { JellyfinTopItem, JellyfinStatsTopContent } from "@trakt-dashboard/types";
import { CARD_BG, CARD_BDR, T1, T2, T3, COLORS } from "../stats/tokens";
import { t } from "../../lib/i18n";

interface RankListProps {
    items: JellyfinTopItem[];
    icon: React.ReactNode;
    title: string;
    color: (typeof COLORS)[keyof typeof COLORS];
}

function RankList({ items, icon, title, color }: RankListProps) {
    const max = items[0]?.playCount ?? 1;

    return (
        <div
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "20px",
                backdropFilter: "blur(24px)",
                padding: "20px 22px",
                flex: "1 1 260px",
                minWidth: 0,
            }}
        >
            <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}
            >
                <span style={{ color: T2 }}>{icon}</span>
                <span
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: T2,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {title}
                </span>
            </div>

            {items.length === 0 ? (
                <div
                    style={{ textAlign: "center", padding: "24px 0", color: T3, fontSize: "13px" }}
                >
                    {t("jellyfinStats.noData")}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {items.map((item, i) => (
                        <div
                            key={item.id}
                            style={{ display: "flex", alignItems: "center", gap: "10px" }}
                        >
                            <span
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: i === 0 ? color.light : T3,
                                    width: "18px",
                                    textAlign: "right",
                                    flexShrink: 0,
                                }}
                            >
                                {i + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: "13px",
                                        color: T1,
                                        fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        marginBottom: "4px",
                                    }}
                                >
                                    {item.name}
                                </div>
                                <div
                                    style={{
                                        height: "3px",
                                        borderRadius: "999px",
                                        background: "var(--color-surface)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${(item.playCount / max) * 100}%`,
                                            background: color.base,
                                            borderRadius: "999px",
                                            transition: "width 0.6s ease",
                                        }}
                                    />
                                </div>
                            </div>
                            <span style={{ fontSize: "11px", color: T3, flexShrink: 0 }}>
                                {item.playCount}×
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface Props {
    data: JellyfinStatsTopContent | undefined;
    isLoading: boolean;
}

export function TopContent({ data, isLoading }: Props) {
    return (
        <div>
            <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}
            >
                <Trophy size={14} color={T2} />
                <span
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: T2,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("jellyfinStats.topContent")}
                </span>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {isLoading ? (
                    <>
                        <div
                            style={{
                                background: CARD_BG,
                                border: CARD_BDR,
                                borderRadius: "20px",
                                height: "300px",
                                flex: "1 1 260px",
                                opacity: 0.5,
                            }}
                        />
                        <div
                            style={{
                                background: CARD_BG,
                                border: CARD_BDR,
                                borderRadius: "20px",
                                height: "300px",
                                flex: "1 1 260px",
                                opacity: 0.5,
                            }}
                        />
                    </>
                ) : (
                    <>
                        <RankList
                            items={data?.movies ?? []}
                            icon={<Film size={14} />}
                            title={t("jellyfinStats.topMovies")}
                            color={COLORS.violet}
                        />
                        <RankList
                            items={data?.series ?? []}
                            icon={<Tv2 size={14} />}
                            title={t("jellyfinStats.topSeries")}
                            color={COLORS.sky}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

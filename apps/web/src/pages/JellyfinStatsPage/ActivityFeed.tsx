import { Clock, Film, Tv2, Activity } from "lucide-react";
import type { JellyfinActivityEntry } from "@trakt-dashboard/types";
import { CARD_BG, CARD_BDR, T1, T2, T3 } from "../stats/tokens";
import { t } from "../../lib/i18n";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Props {
    data: JellyfinActivityEntry[];
    isLoading: boolean;
}

function EntryRow({ entry }: { entry: JellyfinActivityEntry }) {
    const isMovie =
        entry.name.toLowerCase().includes("movie") || entry.type === "VideoPlaybackStopped";
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border-subtle)",
            }}
        >
            <div
                style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(56,189,248,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--color-accent-light)",
                }}
            >
                {isMovie ? <Film size={14} /> : <Tv2 size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: "13px",
                        color: T1,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {entry.name}
                </div>
                {entry.userName && (
                    <div style={{ fontSize: "11px", color: T3, marginTop: "2px" }}>
                        {entry.userName}
                    </div>
                )}
            </div>
            <div
                style={{
                    fontSize: "11px",
                    color: T3,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                }}
            >
                <Clock size={11} />
                {dayjs(entry.date).fromNow()}
            </div>
        </div>
    );
}

export function ActivityFeed({ data, isLoading }: Props) {
    return (
        <div
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "20px",
                backdropFilter: "blur(24px)",
                padding: "20px 22px",
            }}
        >
            <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}
            >
                <Activity size={14} color={T2} />
                <span
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: T2,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("jellyfinStats.recentActivity")}
                </span>
            </div>

            {isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: "44px",
                                borderRadius: "8px",
                                background: "var(--color-surface)",
                                opacity: 0.5,
                                animation: "pulse 1.5s infinite",
                            }}
                        />
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div
                    style={{ textAlign: "center", padding: "32px 0", color: T3, fontSize: "13px" }}
                >
                    {t("jellyfinStats.noActivity")}
                </div>
            ) : (
                <div>
                    {data.map((entry, i) => (
                        <EntryRow key={`${entry.date}-${i}`} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}

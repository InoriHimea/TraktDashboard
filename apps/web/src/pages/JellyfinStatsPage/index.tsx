import { Loader2, ServerOff } from "lucide-react";
import { useSettings } from "../../hooks";
import {
    useJellyfinStatsOverview,
    useJellyfinStatsActivity,
    useJellyfinStatsTopContent,
    useJellyfinStatsHeatmap,
} from "../../hooks";
import { LibraryOverview } from "./LibraryOverview";
import { ActivityFeed } from "./ActivityFeed";
import { TopContent } from "./TopContent";
import { PlayHeatmap } from "./PlayHeatmap";
import { COLORS, T1, T2, T3 } from "../stats/tokens";
import { t } from "../../lib/i18n";

export default function JellyfinStatsPage() {
    const { data: settings, isLoading: settingsLoading } = useSettings();
    const jellyfinConfigured = !!settings?.jellyfinUrl;

    const { data: overview, isLoading: overviewLoading } =
        useJellyfinStatsOverview(jellyfinConfigured);
    const { data: activity = [], isLoading: activityLoading } = useJellyfinStatsActivity(
        50,
        jellyfinConfigured,
    );
    const { data: topContent, isLoading: topLoading } =
        useJellyfinStatsTopContent(jellyfinConfigured);
    const { data: heatmap = [], isLoading: heatmapLoading } =
        useJellyfinStatsHeatmap(jellyfinConfigured);

    if (settingsLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                }}
            >
                <Loader2 size={24} color={COLORS.violet.base} className="animate-spin" />
            </div>
        );
    }

    if (!jellyfinConfigured) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                    gap: "16px",
                    textAlign: "center",
                    padding: "32px",
                }}
            >
                <div
                    style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "16px",
                        background: "rgba(124,106,247,0.12)",
                        border: "1px solid rgba(124,106,247,0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: COLORS.violet.light,
                    }}
                >
                    <ServerOff size={24} />
                </div>
                <div>
                    <div
                        style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: T1,
                            marginBottom: "6px",
                        }}
                    >
                        {t("jellyfinStats.notConfigured")}
                    </div>
                    <div style={{ fontSize: "13px", color: T3, maxWidth: "340px" }}>
                        {t("jellyfinStats.notConfiguredDesc")}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: "1100px",
                margin: "0 auto",
                padding: "28px 20px 60px",
                display: "flex",
                flexDirection: "column",
                gap: "28px",
            }}
        >
            {/* Page header */}
            <div>
                <h1
                    style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: T1,
                        margin: 0,
                        letterSpacing: "-0.03em",
                    }}
                >
                    Jellyfin
                </h1>
                <p style={{ fontSize: "13px", color: T2, marginTop: "4px" }}>
                    {t("jellyfinStats.subtitle")}
                </p>
            </div>

            {/* Library overview */}
            <LibraryOverview data={overview} isLoading={overviewLoading} />

            {/* Top content */}
            <TopContent data={topContent} isLoading={topLoading} />

            {/* Play heatmap */}
            <PlayHeatmap data={heatmap} isLoading={heatmapLoading} />

            {/* Activity feed */}
            <ActivityFeed data={activity} isLoading={activityLoading} />
        </div>
    );
}

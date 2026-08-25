import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { useRestorableHistory, useRestoreHistory } from "../hooks";
import { t } from "../lib/i18n";
import { useToast } from "../lib/toast";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Tag } from "../components/ui/Tag";
import type { RestorableHistoryEntry } from "@trakt-dashboard/types";

// Primary label uses the display-language title (falling back to the original
// when untranslated); the original is surfaced as a secondary line, but only
// when it actually differs — same convention as the duplicate-audit page.
function entryTitles(entry: RestorableHistoryEntry): { primary: string; original: string | null } {
    if (entry.mediaType === "episode") {
        const season = String(entry.seasonNumber ?? 0).padStart(2, "0");
        const episode = String(entry.episodeNumber ?? 0).padStart(2, "0");
        const showName = entry.showTranslatedName ?? entry.showTitle ?? "";
        const episodeTitle = entry.episodeTranslatedTitle ?? entry.episodeTitle;
        const primary = `${showName} S${season}E${episode}${
            episodeTitle ? ` · ${episodeTitle}` : ""
        }`;

        const showOriginal =
            entry.showTranslatedName && entry.showTranslatedName !== entry.showTitle
                ? entry.showTitle
                : null;
        const episodeOriginal =
            entry.episodeTranslatedTitle && entry.episodeTranslatedTitle !== entry.episodeTitle
                ? entry.episodeTitle
                : null;
        const originalParts = [showOriginal, episodeOriginal].filter(
            (v): v is string => v !== null,
        );
        return { primary, original: originalParts.length > 0 ? originalParts.join(" · ") : null };
    }
    return { primary: entry.movieTitle ?? "", original: null };
}

export default function HistoryRestorePage() {
    const [includeManual, setIncludeManual] = useState(false);
    const { data, isLoading, isError } = useRestorableHistory(includeManual);
    const restoreHistory = useRestoreHistory();
    const { toast } = useToast();
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [confirming, setConfirming] = useState(false);

    const entries = useMemo(() => data?.entries ?? [], [data]);

    // Re-seed (clear) the selection whenever a fresh dataset lands — e.g. the
    // includeManual toggle changed — so stale ids from the previous list can't
    // linger in `selected`. Adjusting state during render avoids an extra
    // commit-then-rerender pass (same pattern as the duplicate-audit page).
    const [seededFor, setSeededFor] = useState(data);
    if (data !== seededFor) {
        setSeededFor(data);
        setSelected(new Set());
    }

    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function selectAll() {
        setSelected(new Set(entries.map((e) => e.id)));
    }

    function deselectAll() {
        setSelected(new Set());
    }

    async function handleConfirmRestore() {
        try {
            const res = await restoreHistory.mutateAsync(Array.from(selected));
            setConfirming(false);
            if (res.unconfirmed > 0 || res.failed > 0) {
                toast(
                    t("historyRestore.restorePartial", {
                        restored: res.restored,
                        unconfirmed: res.unconfirmed,
                        failed: res.failed,
                    }),
                    "error",
                );
            } else {
                toast(t("historyRestore.restoreSuccess", { restored: res.restored }), "success");
            }
        } catch (e) {
            setConfirming(false);
            toast(e instanceof Error ? e.message : t("historyRestore.restoreFailed"), "error");
        }
    }

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="app-container py-8 pb-28">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <Link
                            to="/history"
                            className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                            title={t("common.back")}
                        >
                            <ArrowLeft className="size-[15px]" />
                        </Link>
                        <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--action-cyan-border)] bg-[var(--action-cyan-surface)] text-[var(--action-cyan-text)]">
                            <RotateCcw className="size-[15px]" />
                        </div>
                        <h1 className="text-lg font-semibold leading-tight">
                            {t("historyRestore.title")}
                        </h1>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        <input
                            type="checkbox"
                            checked={includeManual}
                            onChange={(e) => setIncludeManual(e.target.checked)}
                        />
                        {t("historyRestore.includeManualLabel")}
                    </label>
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t("historyRestore.loading")}
                        </p>
                    </div>
                )}

                {!isLoading && isError && (
                    <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
                        {t("historyRestore.loadFailed")}
                    </p>
                )}

                {!isLoading && !isError && entries.length === 0 && (
                    <div className="py-16 text-center">
                        <p className="mb-1 text-sm font-semibold">{t("historyRestore.empty")}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t("historyRestore.emptyHint")}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && entries.length > 0 && (
                    <>
                        <div className="mb-4 text-xs text-[var(--color-text-muted)]">
                            {t("historyRestore.summaryCount", { count: entries.length })}
                        </div>

                        <div className="mb-3 flex gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                                {t("historyDuplicates.selectAll")}
                            </button>
                            <button
                                type="button"
                                onClick={deselectAll}
                                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            >
                                {t("historyDuplicates.deselectAll")}
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {entries.map((entry) => {
                                const { primary, original } = entryTitles(entry);
                                return (
                                    <label
                                        key={entry.id}
                                        className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(entry.id)}
                                            onChange={() => toggle(entry.id)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold">{primary}</p>
                                            {original && (
                                                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                                    {original}
                                                </p>
                                            )}
                                        </div>
                                        <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
                                            {new Date(entry.watchedAt).toLocaleString()}
                                        </span>
                                        <Tag
                                            color={entry.source === "trakt" ? "amber" : "slate"}
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full px-2 py-0.5"
                                        >
                                            {entry.source === "trakt"
                                                ? t("historyRestore.sourceTraktMissing")
                                                : t("historyRestore.sourceManualOnly")}
                                        </Tag>
                                    </label>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {selected.size > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-[var(--color-border)] bg-[var(--color-surface)] py-3">
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="rounded-lg bg-[var(--action-violet-solid)] px-4 py-2 text-sm font-semibold text-[var(--action-violet-primary-text)] hover:opacity-90"
                    >
                        {t("historyRestore.restoreSelected", { count: selected.size })}
                    </button>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirming}
                title={t("historyRestore.confirmTitle")}
                description={t("historyRestore.confirmDesc", { count: selected.size })}
                confirmColor="violet"
                isLoading={restoreHistory.isPending}
                onConfirm={handleConfirmRestore}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}

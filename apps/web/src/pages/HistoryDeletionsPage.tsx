import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useHistoryDeletions, useRestoreFromDeletions } from "../hooks";
import { t } from "../lib/i18n";
import { useToast } from "../lib/toast";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Tag } from "../components/ui/Tag";
import type { HistoryDeletionEntry } from "@trakt-dashboard/types";

// Same title convention as the duplicate-audit and restore pages: translated
// name primary, original as a secondary line only when it actually differs.
function entryTitles(entry: HistoryDeletionEntry): { primary: string; original: string | null } {
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

export default function HistoryDeletionsPage() {
    const { data, isLoading, isError } = useHistoryDeletions();
    const restoreFromDeletions = useRestoreFromDeletions();
    const { toast } = useToast();
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [confirming, setConfirming] = useState(false);

    const entries = useMemo(() => data?.entries ?? [], [data]);

    // Drop stale ids from the selection whenever a fresh dataset lands (e.g.
    // right after a restore). Adjusting state during render avoids an extra
    // commit-then-rerender pass, same pattern as the other two audit pages.
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
            const res = await restoreFromDeletions.mutateAsync(Array.from(selected));
            setConfirming(false);
            toast(t("historyDeletions.restoreSuccess", { restored: res.restored }), "success");
        } catch (e) {
            setConfirming(false);
            toast(e instanceof Error ? e.message : t("historyDeletions.restoreFailed"), "error");
        }
    }

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="app-container py-8 pb-28">
                {/* Header */}
                <div className="mb-6 flex items-center gap-2.5">
                    <Link
                        to="/history"
                        className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                        title={t("common.back")}
                    >
                        <ArrowLeft className="size-[15px]" />
                    </Link>
                    <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--action-cyan-border)] bg-[var(--action-cyan-surface)] text-[var(--action-cyan-text)]">
                        <Trash2 className="size-[15px]" />
                    </div>
                    <h1 className="text-lg font-semibold leading-tight">
                        {t("historyDeletions.title")}
                    </h1>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
                    </div>
                )}

                {!isLoading && isError && (
                    <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
                        {t("historyDeletions.loadFailed")}
                    </p>
                )}

                {!isLoading && !isError && entries.length === 0 && (
                    <div className="py-16 text-center">
                        <p className="mb-1 text-sm font-semibold">{t("historyDeletions.empty")}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t("historyDeletions.emptyHint")}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && entries.length > 0 && (
                    <>
                        <div className="mb-4 text-xs text-[var(--color-text-muted)]">
                            {t("historyDeletions.summaryCount", { count: entries.length })}
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
                                            {new Date(entry.deletedAt).toLocaleString()}
                                        </span>
                                        <Tag
                                            color={entry.reason === "manual" ? "slate" : "amber"}
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full px-2 py-0.5"
                                        >
                                            {entry.reason === "manual"
                                                ? t("historyDeletions.reasonManual")
                                                : t("historyDeletions.reasonDuplicateCleanup")}
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
                        className="rounded-lg bg-[var(--action-emerald-solid)] px-4 py-2 text-sm font-semibold text-[var(--action-emerald-primary-text)] hover:opacity-90"
                    >
                        {t("historyDeletions.restoreSelected", { count: selected.size })}
                    </button>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirming}
                title={t("historyDeletions.confirmTitle")}
                description={t("historyDeletions.confirmDesc", { count: selected.size })}
                confirmColor="emerald"
                isLoading={restoreFromDeletions.isPending}
                onConfirm={handleConfirmRestore}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useHistoryDuplicates, useRemoveHistoryDuplicates } from "../hooks";
import { t } from "../lib/i18n";
import { useToast } from "../lib/toast";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import type { HistoryDuplicateGroup } from "@trakt-dashboard/types";

const DEFAULT_WINDOW_HOURS = 72;
const MIN_WINDOW_HOURS = 1;
const MAX_WINDOW_HOURS = 24 * 30;

// A separate, smaller, fixed threshold from the (adjustable) clustering window —
// this one only powers the "N groups with short gaps" stat used to spot the
// not-yet-diagnosed root cause 2 pattern (minutes-apart duplicates), distinct from
// root cause 1's ~daily cadence.
const SHORT_INTERVAL_HOURS = 6;

function groupLabel(group: HistoryDuplicateGroup): string {
    if (group.mediaType === "episode") {
        const season = String(group.seasonNumber ?? 0).padStart(2, "0");
        const episode = String(group.episodeNumber ?? 0).padStart(2, "0");
        return `${group.showTitle ?? ""} S${season}E${episode}${
            group.episodeTitle ? ` · ${group.episodeTitle}` : ""
        }`;
    }
    return group.movieTitle ?? "";
}

function formatGap(hours: number): string {
    if (hours < 24) return t("historyDuplicates.gapHours", { hours: Math.round(hours) });
    return t("historyDuplicates.gapDays", { days: Math.round(hours / 24) });
}

function suggestedIdsIn(data: { groups: HistoryDuplicateGroup[] } | undefined): Set<number> {
    const ids = new Set<number>();
    if (!data) return ids;
    for (const group of data.groups) {
        for (const entry of group.entries) {
            if (entry.suggested) ids.add(entry.id);
        }
    }
    return ids;
}

export default function HistoryDuplicatesPage() {
    const [windowHours, setWindowHours] = useState(DEFAULT_WINDOW_HOURS);
    const { data, isLoading, isError } = useHistoryDuplicates(windowHours);
    const removeDuplicates = useRemoveHistoryDuplicates();
    const { toast } = useToast();
    // Pre-checked with whatever's suggested on the very first render; re-seeded
    // below whenever a *later* dataset lands (window change, post-delete refetch).
    const [selected, setSelected] = useState<Set<number>>(() => suggestedIdsIn(data));
    const [confirming, setConfirming] = useState(false);

    const groups = useMemo(() => data?.groups ?? [], [data]);

    // Re-seed the default selection (suggested entries pre-checked) whenever a
    // fresh dataset lands, without clobbering the user's own toggles mid-session.
    // Adjusting state during render (React's recommended pattern for "reset state
    // when an input changes") rather than in an effect avoids an extra
    // commit-then-rerender pass.
    const [seededFor, setSeededFor] = useState(data);
    if (data !== seededFor) {
        setSeededFor(data);
        setSelected(suggestedIdsIn(data));
    }

    const suggestedCount = useMemo(() => {
        let count = 0;
        for (const group of groups) for (const entry of group.entries) if (entry.suggested) count++;
        return count;
    }, [groups]);

    const shortIntervalGroupCount = useMemo(() => {
        let count = 0;
        for (const group of groups) {
            const hasShortGap = group.entries.some(
                (entry) =>
                    entry.gapFromPreviousHours !== null &&
                    entry.gapFromPreviousHours < SHORT_INTERVAL_HOURS,
            );
            if (hasShortGap) count++;
        }
        return count;
    }, [groups]);

    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function selectAll() {
        const all = new Set<number>();
        for (const group of groups) for (const entry of group.entries) all.add(entry.id);
        setSelected(all);
    }

    function deselectAll() {
        setSelected(new Set());
    }

    async function handleConfirmDelete() {
        try {
            const res = await removeDuplicates.mutateAsync(Array.from(selected));
            setConfirming(false);
            toast(t("historyDuplicates.deleteSuccess", { deleted: res.deleted }), "success");
        } catch (e) {
            setConfirming(false);
            toast(e instanceof Error ? e.message : t("historyDuplicates.deleteFailed"), "error");
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
                            <Copy className="size-[15px]" />
                        </div>
                        <h1 className="text-lg font-semibold leading-tight">
                            {t("historyDuplicates.title")}
                        </h1>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        {t("historyDuplicates.windowLabel")}
                        <input
                            type="number"
                            min={MIN_WINDOW_HOURS}
                            max={MAX_WINDOW_HOURS}
                            value={windowHours}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v)) {
                                    setWindowHours(
                                        Math.min(
                                            Math.max(Math.round(v), MIN_WINDOW_HOURS),
                                            MAX_WINDOW_HOURS,
                                        ),
                                    );
                                }
                            }}
                            className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
                        />
                    </label>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
                    </div>
                )}

                {!isLoading && isError && (
                    <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
                        {t("historyDuplicates.loadFailed")}
                    </p>
                )}

                {!isLoading && !isError && groups.length === 0 && (
                    <div className="py-16 text-center">
                        <p className="mb-1 text-sm font-semibold">{t("historyDuplicates.empty")}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {t("historyDuplicates.emptyHint")}
                        </p>
                    </div>
                )}

                {!isLoading && !isError && groups.length > 0 && (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                            <span>
                                {t("historyDuplicates.summaryGroups", { count: groups.length })}
                            </span>
                            <span>
                                {t("historyDuplicates.summarySuggested", { count: suggestedCount })}
                            </span>
                            {shortIntervalGroupCount > 0 && (
                                <span>
                                    {t("historyDuplicates.summaryShortBursts", {
                                        count: shortIntervalGroupCount,
                                        hours: SHORT_INTERVAL_HOURS,
                                    })}
                                </span>
                            )}
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

                        <div className="flex flex-col gap-4">
                            {groups.map((group, gi) => (
                                <div
                                    key={gi}
                                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                                >
                                    <p className="mb-3 text-sm font-semibold">
                                        {groupLabel(group)}
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {group.entries.map((entry) => (
                                            <label
                                                key={entry.id}
                                                className="flex items-center gap-3 text-sm"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(entry.id)}
                                                    onChange={() => toggle(entry.id)}
                                                />
                                                <span>
                                                    {new Date(entry.watchedAt).toLocaleString()}
                                                </span>
                                                {entry.gapFromPreviousHours !== null && (
                                                    <span className="text-xs text-[var(--color-text-muted)]">
                                                        {formatGap(entry.gapFromPreviousHours)}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {selected.size > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-[var(--color-border)] bg-[var(--color-surface)] py-3">
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                    >
                        {t("historyDuplicates.deleteSelected", { count: selected.size })}
                    </button>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirming}
                title={t("historyDuplicates.confirmTitle")}
                description={t("historyDuplicates.confirmDesc", { count: selected.size })}
                confirmColor="rose"
                isLoading={removeDuplicates.isPending}
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirming(false)}
            />
        </div>
    );
}

import { useState, useEffect } from "react";
import { Clock, Calendar, HelpCircle, CheckCircle } from "lucide-react";
import { SlidingPanel } from "./SlidingPanel";
import { DateTimePickerModal } from "./DateTimePickerModal";
import { Button } from "./ui/Button";
import { useMarkWatched } from "../hooks";

interface WatchActionPanelProps {
    open: boolean;
    onClose: () => void;
    episodeId: number;
    showId: number;
    seasonNumber: number;
    episodeNumber: number;
    airDate: string | null;
    onSuccess: () => void;
}

type ViewState = "options" | "confirm";
type WatchOption = "just-now" | "release-date" | "other-date" | "unknown-date";

export function WatchActionPanel({
    open,
    onClose,
    episodeId,
    showId,
    seasonNumber,
    episodeNumber,
    airDate,
    onSuccess,
}: WatchActionPanelProps) {
    const [viewState, setViewState] = useState<ViewState>("options");
    const [selectedOption, setSelectedOption] = useState<WatchOption | null>(
        null,
    );
    const [selectedDateTime, setSelectedDateTime] = useState<string | null>(
        null,
    );
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const markWatched = useMarkWatched(showId, seasonNumber, episodeNumber);

    // Reset state when panel opens or closes
    useEffect(() => {
        if (open) {
            setViewState("options");
            setSelectedOption(null);
            setSelectedDateTime(null);
            setError(null);
            setShowDatePicker(false);
        } else {
            setShowDatePicker(false);
        }
    }, [open]);

    const handleOptionClick = (option: WatchOption) => {
        setError(null);
        setSelectedOption(option);

        if (option === "other-date") {
            setShowDatePicker(true);
        } else {
            setViewState("confirm");
        }
    };

    const handleDateTimeConfirm = (isoString: string) => {
        setSelectedDateTime(isoString);
        setShowDatePicker(false);
        setViewState("confirm");
    };

    const getWatchedAtValue = (): string | null => {
        switch (selectedOption) {
            case "just-now":
                return new Date().toISOString();
            case "release-date":
                return airDate ? new Date(airDate).toISOString() : null;
            case "other-date":
                return selectedDateTime;
            case "unknown-date":
                return null;
            default:
                return null;
        }
    };

    const getTimeSummary = (): string => {
        switch (selectedOption) {
            case "just-now":
                return "刚刚";
            case "release-date":
                return airDate
                    ? `首播日期 (${new Date(airDate).toLocaleDateString("zh-CN")})`
                    : "";
            case "other-date":
                return selectedDateTime
                    ? new Date(selectedDateTime).toLocaleString("zh-CN")
                    : "";
            case "unknown-date":
                return "未知时间";
            default:
                return "";
        }
    };

    const handleConfirm = async () => {
        setError(null);
        const watchedAt = getWatchedAtValue();

        try {
            await markWatched.mutateAsync(watchedAt);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "标记失败，请重试");
        }
    };

    const handleCancel = () => {
        setViewState("options");
        setSelectedOption(null);
        setSelectedDateTime(null);
        setError(null);
    };

    return (
        <>
            <SlidingPanel open={open} onClose={onClose} title="标记为已观看">
                <div className="p-6">
                    {viewState === "options" && (
                        <div className="space-y-3">
                            <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                选择观看时间
                            </p>

                            {/* Just now */}
                            <button
                                onClick={() => handleOptionClick("just-now")}
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                                    <Clock
                                        size={18}
                                        className="text-[var(--color-accent)]"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--color-text)]">
                                        刚刚
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        使用当前时间
                                    </div>
                                </div>
                            </button>

                            {/* Release date */}
                            <button
                                onClick={() =>
                                    handleOptionClick("release-date")
                                }
                                disabled={!airDate}
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-surface-2)]"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Calendar
                                        size={18}
                                        className="text-blue-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--color-text)]">
                                        首播日期
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        {airDate
                                            ? new Date(
                                                  airDate,
                                              ).toLocaleDateString("zh-CN")
                                            : "首播日期不可用"}
                                    </div>
                                </div>
                            </button>

                            {/* Other date */}
                            <button
                                onClick={() => handleOptionClick("other-date")}
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                    <Calendar
                                        size={18}
                                        className="text-green-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--color-text)]">
                                        其他日期
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        选择自定义时间
                                    </div>
                                </div>
                            </button>

                            {/* Unknown date */}
                            <button
                                onClick={() =>
                                    handleOptionClick("unknown-date")
                                }
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center shrink-0">
                                    <HelpCircle
                                        size={18}
                                        className="text-gray-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-[var(--color-text)]">
                                        未知时间
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                        不记录具体时间
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {viewState === "confirm" && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                                        <CheckCircle
                                            size={18}
                                            className="text-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-[var(--color-text)] mb-1">
                                            确认标记为已观看
                                        </div>
                                        <div className="text-xs text-[var(--color-text-muted)]">
                                            观看时间：{getTimeSummary()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    variant="ghost"
                                    size="md"
                                    onClick={handleCancel}
                                    className="flex-1"
                                    disabled={markWatched.isPending}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleConfirm}
                                    className="flex-1"
                                    disabled={markWatched.isPending}
                                >
                                    {markWatched.isPending
                                        ? "标记中..."
                                        : "标记为已观看"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </SlidingPanel>

            {/* DateTime Picker Modal */}
            <DateTimePickerModal
                open={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onConfirm={handleDateTimeConfirm}
            />
        </>
    );
}

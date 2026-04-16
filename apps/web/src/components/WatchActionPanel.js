import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Clock, Calendar, HelpCircle, CheckCircle } from "lucide-react";
import { SlidingPanel } from "./SlidingPanel";
import { DateTimePickerModal } from "./DateTimePickerModal";
import { Button } from "./ui/Button";
import { useMarkWatched } from "../hooks";
export function WatchActionPanel({ open, onClose, episodeId, showId, seasonNumber, episodeNumber, airDate, onSuccess, }) {
    const [viewState, setViewState] = useState("options");
    const [selectedOption, setSelectedOption] = useState(null);
    const [selectedDateTime, setSelectedDateTime] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [error, setError] = useState(null);
    const markWatched = useMarkWatched(showId, seasonNumber, episodeNumber);
    // Reset state when panel opens or closes
    useEffect(() => {
        if (open) {
            setViewState("options");
            setSelectedOption(null);
            setSelectedDateTime(null);
            setError(null);
            setShowDatePicker(false);
        }
        else {
            setShowDatePicker(false);
        }
    }, [open]);
    const handleOptionClick = (option) => {
        setError(null);
        setSelectedOption(option);
        if (option === "other-date") {
            setShowDatePicker(true);
        }
        else {
            setViewState("confirm");
        }
    };
    const handleDateTimeConfirm = (isoString) => {
        setSelectedDateTime(isoString);
        setShowDatePicker(false);
        setViewState("confirm");
    };
    const getWatchedAtValue = () => {
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
    const getTimeSummary = () => {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "标记失败，请重试");
        }
    };
    const handleCancel = () => {
        setViewState("options");
        setSelectedOption(null);
        setSelectedDateTime(null);
        setError(null);
    };
    return (_jsxs(_Fragment, { children: [_jsx(SlidingPanel, { open: open, onClose: onClose, title: "\u6807\u8BB0\u4E3A\u5DF2\u89C2\u770B", children: _jsxs("div", { className: "p-6", children: [viewState === "options" && (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-[var(--color-text-muted)] mb-4", children: "\u9009\u62E9\u89C2\u770B\u65F6\u95F4" }), _jsxs("button", { onClick: () => handleOptionClick("just-now"), className: "w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0", children: _jsx(Clock, { size: 18, className: "text-[var(--color-accent)]" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-text)]", children: "\u521A\u521A" }), _jsx("div", { className: "text-xs text-[var(--color-text-muted)]", children: "\u4F7F\u7528\u5F53\u524D\u65F6\u95F4" })] })] }), _jsxs("button", { onClick: () => handleOptionClick("release-date"), disabled: !airDate, className: "w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-surface-2)]", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0", children: _jsx(Calendar, { size: 18, className: "text-blue-400" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-text)]", children: "\u9996\u64AD\u65E5\u671F" }), _jsx("div", { className: "text-xs text-[var(--color-text-muted)]", children: airDate
                                                        ? new Date(airDate).toLocaleDateString("zh-CN")
                                                        : "首播日期不可用" })] })] }), _jsxs("button", { onClick: () => handleOptionClick("other-date"), className: "w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0", children: _jsx(Calendar, { size: 18, className: "text-green-400" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-text)]", children: "\u5176\u4ED6\u65E5\u671F" }), _jsx("div", { className: "text-xs text-[var(--color-text-muted)]", children: "\u9009\u62E9\u81EA\u5B9A\u4E49\u65F6\u95F4" })] })] }), _jsxs("button", { onClick: () => handleOptionClick("unknown-date"), className: "w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-colors text-left", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center shrink-0", children: _jsx(HelpCircle, { size: 18, className: "text-gray-400" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-text)]", children: "\u672A\u77E5\u65F6\u95F4" }), _jsx("div", { className: "text-xs text-[var(--color-text-muted)]", children: "\u4E0D\u8BB0\u5F55\u5177\u4F53\u65F6\u95F4" })] })] })] })), viewState === "confirm" && (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0", children: _jsx(CheckCircle, { size: 18, className: "text-[var(--color-accent)]" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-[var(--color-text)] mb-1", children: "\u786E\u8BA4\u6807\u8BB0\u4E3A\u5DF2\u89C2\u770B" }), _jsxs("div", { className: "text-xs text-[var(--color-text-muted)]", children: ["\u89C2\u770B\u65F6\u95F4\uFF1A", getTimeSummary()] })] })] }) }), error && (_jsx("div", { className: "p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-sm text-red-400", children: error })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { variant: "ghost", size: "md", onClick: handleCancel, className: "flex-1", disabled: markWatched.isPending, children: "\u53D6\u6D88" }), _jsx(Button, { variant: "primary", size: "md", onClick: handleConfirm, className: "flex-1", disabled: markWatched.isPending, children: markWatched.isPending
                                                ? "标记中..."
                                                : "标记为已观看" })] })] }))] }) }), _jsx(DateTimePickerModal, { open: showDatePicker, onClose: () => setShowDatePicker(false), onConfirm: handleDateTimeConfirm })] }));
}
//# sourceMappingURL=WatchActionPanel.js.map
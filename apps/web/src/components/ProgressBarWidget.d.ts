export interface ProgressBarWidgetProps {
    /** 总时长（分钟） */
    totalMinutes?: number;
    /** 已看时长（分钟），与 percentage 二选一 */
    watchedMinutes?: number;
    /** 直接传入百分比 0-100 */
    percentage?: number;
    /** 剩余集数（如 "1 remaining"） */
    remainingEpisodes?: number;
    /** 自定义左侧标签 */
    watchedLabel?: string;
    /** 自定义右侧文字 */
    remainingLabel?: string;
    className?: string;
}
export declare function ProgressBarWidget({ totalMinutes, watchedMinutes, percentage, remainingEpisodes, watchedLabel, remainingLabel, className, }: ProgressBarWidgetProps): import("react/jsx-runtime").JSX.Element;
export interface InlineProgressBarProps {
    percentage: number;
    trackHeight?: number;
    className?: string;
    showPct?: boolean;
}
export declare function InlineProgressBar({ percentage, trackHeight, className, showPct, }: InlineProgressBarProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ProgressBarWidget.d.ts.map
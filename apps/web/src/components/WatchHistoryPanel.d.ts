import "dayjs/locale/zh-cn";
interface WatchHistoryPanelProps {
    open: boolean;
    onClose: () => void;
    showId: number;
    seasonNumber?: number;
    episodeNumber?: number;
    onDeleted: () => void;
}
export declare function WatchHistoryPanel({ open, onClose, showId, seasonNumber, episodeNumber, onDeleted, }: WatchHistoryPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=WatchHistoryPanel.d.ts.map
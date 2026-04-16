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
export declare function WatchActionPanel({ open, onClose, episodeId, showId, seasonNumber, episodeNumber, airDate, onSuccess, }: WatchActionPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=WatchActionPanel.d.ts.map
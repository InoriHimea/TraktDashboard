/**
 * MetadataSidebar — 玻璃拟物化元数据与统计侧边栏
 *
 * 包含:
 *   - RatingCard: 评分展示
 *   - ShowInfoGrid: 作品信息网格（平台/首播/季数/集数）
 *   - GenreTags: 类型标签组
 *   - SeasonProgressWall: 分季进度墙
 *
 * 每个子组件均可独立使用，也可通过 <MetadataSidebar /> 组合渲染
 */
import type { ReactNode } from "react";
import type { Show } from "@trakt-dashboard/types";
export interface RatingCardProps {
    /** 0-10 评分 */
    score?: number | null;
    /** 评分来源标签，如 "Trakt" / "TMDB" */
    source?: string;
    /** 投票人数 */
    voteCount?: number;
    className?: string;
}
export declare function RatingCard({ score, source, voteCount, className, }: RatingCardProps): import("react/jsx-runtime").JSX.Element;
export interface ShowInfoItem {
    label: string;
    value: string | number | null | undefined;
    icon?: ReactNode;
}
export interface ShowInfoGridProps {
    items: ShowInfoItem[];
    columns?: 2 | 3;
    className?: string;
}
export declare function ShowInfoGrid({ items, columns, className, }: ShowInfoGridProps): import("react/jsx-runtime").JSX.Element;
export interface GenreTagsProps {
    genres: string[];
    className?: string;
}
export declare function GenreTags({ genres, className }: GenreTagsProps): import("react/jsx-runtime").JSX.Element | null;
export interface SeasonProgressItem {
    seasonNumber: number;
    label?: string;
    watchedCount: number;
    episodeCount: number;
    airedCount?: number;
}
export interface SeasonProgressWallProps {
    seasons: SeasonProgressItem[];
    className?: string;
}
export declare function SeasonProgressWall({ seasons, className, }: SeasonProgressWallProps): import("react/jsx-runtime").JSX.Element | null;
export interface MetadataSidebarProps {
    show: Show;
    /** 评分 0-10 */
    rating?: number | null;
    ratingSource?: string;
    ratingVotes?: number;
    seasons?: SeasonProgressItem[];
    className?: string;
}
export declare function MetadataSidebar({ show, rating, ratingSource, ratingVotes, seasons, className, }: MetadataSidebarProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=MetadataSidebar.d.ts.map
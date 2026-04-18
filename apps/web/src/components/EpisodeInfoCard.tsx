import { History, Check } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
}

export function EpisodeInfoCard({ data, onHistoryClick }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  
  // 格式化为 S01E01 样式
  const seasonStr = String(data.seasonNumber).padStart(2, '0');
  const epStr = String(data.episodeNumber).padStart(2, '0');

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部标签行 */}
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 bg-primary/15 text-primary rounded-md text-xs font-bold tracking-widest">
          S{seasonStr} E{epStr}
        </span>
        <span className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {data.show?.title}
        </span>
      </div>

      {/* 大标题 */}
      {episodeTitle && (
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          {episodeTitle}
        </h1>
      )}

      {/* 简介文本：限制最大宽度，增加行高 */}
      {overview && (
        <p className="text-muted-foreground/90 leading-relaxed max-w-2xl text-base mt-2">
          {overview}
        </p>
      )}

      {/* 操作按钮组：对齐并优化高度 */}
      <div className="flex flex-wrap items-center gap-4 mt-4">
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide">
          <Check strokeWidth={3} className="size-5" />
          <span>标记已看</span>
        </button>

        <button
          onClick={onHistoryClick}
          className="bg-secondary/60 text-secondary-foreground hover:bg-secondary h-12 px-6 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide"
        >
          <History className="size-5" />
          <span>历史记录</span>
        </button>
      </div>
    </div>
  );
}
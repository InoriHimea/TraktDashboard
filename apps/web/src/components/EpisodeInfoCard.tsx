import { History, Check } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
}

export function EpisodeInfoCard({ data, onHistoryClick }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const seasonLabel = data.seasonNumber === 0 ? 'Specials' : `Season ${data.seasonNumber}`;
  const episodeTitle = data.translatedTitle ?? data.title;

  return (
    <div className="space-y-4">
      {/* 面包屑导航 */}
      <nav className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
        <span className="truncate">{data.show?.title}</span>
        <span>·</span>
        <span className="whitespace-nowrap">{seasonLabel}</span>
        <span>·</span>
        <span className="whitespace-nowrap">Episode {data.episodeNumber}</span>
      </nav>

      {/* 标题 */}
      {episodeTitle && (
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
          {episodeTitle}
        </h1>
      )}

      {/* 简介内容 */}
      {overview && (
        <p className="text-muted-foreground leading-relaxed max-w-3xl text-sm md:text-base">
          {overview}
        </p>
      )}

      {/* 操作按钮区 */}
      <div className="flex flex-wrap items-center gap-4 pt-4">
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide">
          <Check strokeWidth={2.5} className="size-5" />
          <span>标记已看</span>
        </button>

        <button
          onClick={onHistoryClick}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-6 py-3 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide"
        >
          <History className="size-5" />
          <span>历史记录</span>
        </button>
      </div>
    </div>
  );
}
import { MoreHorizontal, Star } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
}

export function EpisodeInfoCard({ data, onHistoryClick }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  const show = data.show;

  // 模拟一些 HTML 里的元数据，如果 data 中没有，可以使用后备值
  const year = data.airDate ? new Date(data.airDate).getFullYear() : '2026';
  const runtime = data.runtime || 24;

  return (
    <div className="flex flex-col">
      
      {/* 头部信息 trakt-summary-header */}
      <div className="mb-4">
        {/* 剧集名 + 季/集 */}
        <div className="flex flex-wrap items-center gap-2 text-sm mb-1.5">
          <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
            {show?.title}
          </span>
          <span className="text-muted-foreground font-bold">
            Season {data.seasonNumber} • Episode {data.episodeNumber}
          </span>
        </div>
        
        {/* 大标题 */}
        {episodeTitle && (
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            {episodeTitle}
          </h1>
        )}

        {/* 副标题 Meta info */}
        <p className="text-muted-foreground text-sm font-semibold mt-2">
          {year} • {runtime} mins • TV-14 • Anime
        </p>
      </div>

      {/* 评分栏 trakt-summary-ratings */}
      <div className="flex items-center gap-6 mb-6">
        {/* Trakt Rating (基于 HTML SVG 还原) */}
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="text-primary group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" fill="currentColor"></path>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-sm leading-none">74%</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">14 Votes</span>
          </div>
        </div>

        {/* IMDB Rating (使用 HTML 中原汁原味的黄色) */}
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="bg-[#f6c700] text-black rounded px-1.5 py-0.5 font-extrabold text-xs tracking-tighter group-hover:scale-110 transition-transform">
            IMDb
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-sm leading-none">{data.imdbId ? '7.7' : '-'}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">18 Votes</span>
          </div>
        </div>
      </div>

      {/* 剧情简介 */}
      {overview && (
        <div className="mb-8">
          <p className="text-muted-foreground/90 leading-relaxed text-base font-medium line-clamp-6" style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {overview}
          </p>
        </div>
      )}

      {/* 底部操作栏 trakt-summary-actions */}
      <div className="mt-auto pt-4 border-t border-border/30 flex flex-wrap items-center justify-between gap-6">
        
        {/* 左侧：观看操作按钮 (紫色的 Check 与 三个点) */}
        <div className="flex items-center gap-2">
          {/* 标记已看 */}
          <button className="h-10 w-12 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center rounded-lg transition-colors shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.5166 3.15137L8.94531 16.9404L12.0098 19.5117L10.7246 21.0439L0 12.0449L1.28516 10.5127L7.41309 15.6553L18.9844 1.86523L20.5166 3.15137Z" fill="currentColor"></path>
            </svg>
          </button>
          
          {/* 更多菜单 / 历史记录 (映射你现有的 action) */}
          <button 
            onClick={onHistoryClick}
            className="h-10 w-10 bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center rounded-lg transition-colors"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* 右侧：Rate Now 组件 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">Rate</span>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                <Star size={20} strokeWidth={1.5} className="fill-transparent" />
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
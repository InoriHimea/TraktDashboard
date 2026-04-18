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

  const year = data.airDate ? new Date(data.airDate).getFullYear() : '2026';
  const runtime = data.runtime || 24;

  return (
    <div className="flex flex-col">
      
      {/* 头部信息：加大底部留白 mb-8 */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 text-sm md:text-base mb-3">
          <span className="font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer tracking-wide">
            {show?.title}
          </span>
          <span className="text-muted-foreground/60 font-black">/</span>
          <span className="text-muted-foreground font-bold tracking-wide">
            Season {data.seasonNumber} • Episode {data.episodeNumber}
          </span>
        </div>
        
        {episodeTitle && (
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1] mb-5">
            {episodeTitle}
          </h1>
        )}

        <p className="text-muted-foreground text-sm md:text-base font-bold uppercase tracking-widest">
          {year} <span className="mx-2 text-border">•</span> {runtime} mins <span className="mx-2 text-border">•</span> TV-14 <span className="mx-2 text-border">•</span> Anime
        </p>
      </div>

      {/* 评分栏：加大间距 gap-10 和底部留白 mb-10 */}
      <div className="flex items-center gap-10 mb-10">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-primary group-hover:scale-110 transition-transform">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" fill="currentColor"></path>
            </svg>
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-black text-foreground text-lg leading-none mb-1">74%</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">14 Votes</span>
          </div>
        </div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="bg-[#f6c700] text-black rounded-md px-2 py-1 font-black text-sm tracking-tighter group-hover:scale-110 transition-transform">
            IMDb
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-black text-foreground text-lg leading-none mb-1">{show?.imdbId ? '7.7' : '-'}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">18 Votes</span>
          </div>
        </div>
      </div>

      {/* 剧情简介：加大字号和行高，以及底部留白 mb-12 */}
      {overview && (
        <div className="mb-12">
          <p className="text-muted-foreground/80 leading-[1.8] text-lg font-medium max-w-4xl line-clamp-6" style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {overview}
          </p>
        </div>
      )}

      {/* 底部操作栏：顶边距 pt-8 */}
      <div className="mt-auto pt-8 border-t border-border/30 flex flex-wrap items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <button className="h-14 w-16 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center rounded-xl transition-colors shadow-lg active:scale-95">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.5166 3.15137L8.94531 16.9404L12.0098 19.5117L10.7246 21.0439L0 12.0449L1.28516 10.5127L7.41309 15.6553L18.9844 1.86523L20.5166 3.15137Z" fill="currentColor"></path>
            </svg>
          </button>
          
          <button 
            onClick={onHistoryClick}
            className="h-14 w-14 bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center rounded-xl transition-colors active:scale-95"
          >
            <MoreHorizontal size={24} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">Rate</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} className="p-1.5 text-muted-foreground/30 hover:text-primary transition-colors active:scale-90">
                <Star size={24} strokeWidth={2} className="fill-transparent" />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
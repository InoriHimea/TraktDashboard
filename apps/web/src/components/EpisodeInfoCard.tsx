import { Clock } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
  /** 当前集是否已标记为已观看 */
  isWatched: boolean;
}

/** 单 checkmark（未观看） */
function SingleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 12.5L9 17.5L20 6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 双 checkmark（已观看） */
function DoubleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 第一条（偏左，半透明） */}
      <path
        d="M2 12.5L7 17.5L18 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* 第二条（前景） */}
      <path
        d="M6 12.5L11 17.5L22 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EpisodeInfoCard({ data, onHistoryClick, isWatched }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  const show = data.show;

  const year = data.airDate ? new Date(data.airDate).getFullYear() : '2026';
  const runtime = data.runtime || 24;

  return (
    <div className="flex flex-col">

      {/* ── 面包屑 + 标题 ── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm md:text-base mb-3">
          <span className="font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer tracking-wide">
            {show?.title}
          </span>
          <span className="text-muted-foreground/50 font-black">/</span>
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
          {year}
          <span className="mx-2 opacity-30">•</span>
          {runtime} mins
          <span className="mx-2 opacity-30">•</span>
          TV-14
          <span className="mx-2 opacity-30">•</span>
          Anime
        </p>
      </div>

      {/* ── Trakt + IMDb 评分 ── */}
      <div className="flex items-center gap-8 mb-8">
        <div className="flex items-center gap-2.5 cursor-pointer group/star">
          <div className="text-primary group-hover/star:scale-110 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-foreground text-base leading-none mb-0.5">74%</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">14 Votes</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 cursor-pointer group/imdb">
          <div className="bg-[#f6c700] text-black rounded px-1.5 py-0.5 font-black text-xs tracking-tighter group-hover/imdb:scale-110 transition-transform">
            IMDb
          </div>
          <div className="flex flex-col">
            <span className="font-black text-foreground text-base leading-none mb-0.5">
              {show?.imdbId ? '7.7' : '—'}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">18 Votes</span>
          </div>
        </div>
      </div>

      {/* ── 简介 ── */}
      {overview && (
        <div className="mb-10">
          <p
            className="text-muted-foreground/80 leading-[1.85] text-base md:text-lg font-medium max-w-3xl"
            style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {overview}
          </p>
        </div>
      )}

      {/* ── 操作栏（无 RATE）── */}
      <div className="mt-auto pt-6 border-t border-border/30 flex items-center gap-3">

        {/* Watch 按钮 */}
        <button
          className={[
            'h-12 w-14 flex items-center justify-center rounded-xl transition-all active:scale-95 shadow-md',
            isWatched
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/40'
              : 'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground',
          ].join(' ')}
          aria-label={isWatched ? '已观看' : '标记为已观看'}
          title={isWatched ? 'Watched' : 'Mark as watched'}
        >
          {isWatched ? <DoubleCheckIcon /> : <SingleCheckIcon />}
        </button>

        {/* History 按钮 */}
        <button
          onClick={onHistoryClick}
          className="h-12 w-12 bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-xl transition-all active:scale-95"
          aria-label="观看历史"
          title="Watch history"
        >
          <Clock size={20} />
        </button>
      </div>

    </div>
  );
}
import { Clock } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
  isWatched: boolean;
}

function SingleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12.5L9 17.5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12.5L7 17.5L18 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M6 12.5L11 17.5L22 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── 面包屑 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '20px' }}
        className="text-sm md:text-base">
        <span className="font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer tracking-wide">
          {show?.title}
        </span>
        <span className="text-muted-foreground/50 font-black">/</span>
        <span className="text-muted-foreground font-bold tracking-wide">
          Season {data.seasonNumber} • Episode {data.episodeNumber}
        </span>
      </div>

      {/* ── 标题 ── */}
      {episodeTitle && (
        <h1
          style={{ marginBottom: '24px' }}
          className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]"
        >
          {episodeTitle}
        </h1>
      )}

      {/* ── 元信息行 ── */}
      <p style={{ marginBottom: '32px' }} className="text-muted-foreground text-sm md:text-base font-bold uppercase tracking-widest">
        {year}
        <span className="mx-2 opacity-30">•</span>
        {runtime} mins
        <span className="mx-2 opacity-30">•</span>
        TV-14
        <span className="mx-2 opacity-30">•</span>
        Anime
      </p>

      {/* ── Trakt + IMDb 评分 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '40px' }}>
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
        <div style={{ marginBottom: '48px' }}>
          <p
            className="text-muted-foreground/80 text-base md:text-lg font-medium max-w-3xl"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '2',
            }}
          >
            {overview}
          </p>
        </div>
      )}

      {/* ── 操作栏 ── */}
      <div style={{ paddingTop: '24px', borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)', display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Watch 按钮 */}
        <button
          className={[
            'h-12 w-28 flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 shadow-md text-sm font-bold tracking-wide',
            isWatched
              ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-900/40'
              : 'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground',
          ].join(' ')}
          aria-label={isWatched ? '已观看' : '标记为已观看'}
          title={isWatched ? 'Watched' : 'Mark as watched'}
        >
          {isWatched ? <DoubleCheckIcon /> : <SingleCheckIcon />}
          <span>{isWatched ? 'Watched' : 'Watch'}</span>
        </button>

        {/* History 按钮 */}
        <button
          onClick={onHistoryClick}
          className="h-12 w-16 bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg transition-all active:scale-95"
          aria-label="观看历史"
          title="Watch history"
        >
          <Clock size={20} />
        </button>
      </div>

    </div>
  );
}
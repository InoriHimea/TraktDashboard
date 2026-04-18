import { History, Check, ExternalLink } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
}

export function EpisodeInfoCard({ data, onHistoryClick }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  
  const seasonStr = String(data.seasonNumber).padStart(2, '0');
  const epStr = String(data.episodeNumber).padStart(2, '0');

  // 根據 IDE 錯誤訊息，ID 是直接掛在 data 和 data.show 下面的
  const show = data.show;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 bg-primary/15 text-primary rounded-md text-xs font-bold tracking-widest">
          S{seasonStr} E{epStr}
        </span>
        <span className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {show?.title}
        </span>
      </div>

      {episodeTitle && (
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          {episodeTitle}
        </h1>
      )}

      {overview && (
        <p className="text-muted-foreground/90 leading-relaxed max-w-2xl text-base mt-2">
          {overview}
        </p>
      )}

      {/* 修正後的外部鏈接邏輯 */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {show?.imdbId && (
            <a href={`https://www.imdb.com/title/${show.imdbId}`} target="_blank" rel="noreferrer" 
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5C518]/10 text-[#F5C518] hover:bg-[#F5C518]/20 rounded-lg text-xs font-bold transition-colors">
                IMDB <ExternalLink className="size-3" />
            </a>
        )}
        {show?.tmdbId && (
            <a href={`https://www.themoviedb.org/tv/${show.tmdbId}/season/${data.seasonNumber}/episode/${data.episodeNumber}`} target="_blank" rel="noreferrer" 
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01B4E4]/10 text-[#01B4E4] hover:bg-[#01B4E4]/20 rounded-lg text-xs font-bold transition-colors">
                TMDB <ExternalLink className="size-3" />
            </a>
        )}
        {show?.traktSlug && (
            <a href={`https://trakt.tv/shows/${show.traktSlug}/seasons/${data.seasonNumber}/episodes/${data.episodeNumber}`} target="_blank" rel="noreferrer" 
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ED1C24]/10 text-[#ED1C24] hover:bg-[#ED1C24]/20 rounded-lg text-xs font-bold transition-colors">
                Trakt <ExternalLink className="size-3" />
            </a>
        )}
        {show?.tvdbId && (
            <a href={`https://thetvdb.com/deref/${show.tvdbId}`} target="_blank" rel="noreferrer" 
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00A72F]/10 text-[#00A72F] hover:bg-[#00A72F]/20 rounded-lg text-xs font-bold transition-colors">
                TVDB <ExternalLink className="size-3" />
            </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-2">
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide">
          <Check strokeWidth={3} className="size-5" />
          <span>標記已看</span>
        </button>

        <button
          onClick={onHistoryClick}
          className="bg-secondary/60 text-secondary-foreground hover:bg-secondary h-12 px-6 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all rounded-xl cursor-pointer font-bold tracking-wide"
        >
          <History className="size-5" />
          <span>歷史記錄</span>
        </button>
      </div>
    </div>
  );
}
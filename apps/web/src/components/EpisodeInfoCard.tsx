import { ExternalLink, Calendar, Clock } from 'lucide-react';
import type { EpisodeDetailData } from '@trakt-dashboard/types';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
}

export function EpisodeInfoCard({ data }: EpisodeInfoCardProps) {
  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  const show = data.show;

  // 格式化日期 (例如：2026年4月18日)
  const airDateStr = data.airDate 
    ? new Date(data.airDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }) 
    : '';

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      {/* 剧集名称 (Trakt 味：主题色，全大写，较小字号) */}
      <div className="text-primary font-bold tracking-widest uppercase text-xs md:text-sm">
        {show?.title}
      </div>

      {/* 单集大标题 */}
      {episodeTitle && (
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
          {episodeTitle}
        </h1>
      )}

      {/* Season X / Episode Y (Trakt 经典格式) */}
      <h2 className="text-xl md:text-2xl font-light text-muted-foreground mt-1">
        Season {data.seasonNumber} <span className="mx-2 font-thin text-border">/</span> Episode {data.episodeNumber}
      </h2>

      {/* Meta 信息：播出日期与时长 */}
      <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground/80 mt-2 font-medium">
        {airDateStr && (
          <div className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            <span>{airDateStr}</span>
          </div>
        )}
        {data.runtime > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-4" />
            <span>{data.runtime} mins</span>
          </div>
        )}
      </div>

      {/* 简介文本 */}
      {overview && (
        <p className="text-foreground/90 leading-relaxed max-w-3xl text-base md:text-lg mt-4 font-normal">
          {overview}
        </p>
      )}

      {/* 外部链接按钮 (保持极客风格) */}
      <div className="flex flex-wrap items-center gap-2 pt-6">
        {show?.imdbId && (
            <a href={`https://www.imdb.com/title/${show?.imdbId}`} target="_blank" rel="noreferrer" 
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
            <a href={`https://thetvdb.com/deref/${show?.tvdbId}`} target="_blank" rel="noreferrer" 
               className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00A72F]/10 text-[#00A72F] hover:bg-[#00A72F]/20 rounded-lg text-xs font-bold transition-colors">
                TVDB <ExternalLink className="size-3" />
            </a>
        )}
      </div>
    </div>
  );
}
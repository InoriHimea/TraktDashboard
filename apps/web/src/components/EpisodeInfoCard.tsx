import { useState } from 'react';
import { Clock } from 'lucide-react';
import type { EpisodeDetailData, WatchHistoryEntry } from '@trakt-dashboard/types';
import { DateTimePickerModal } from './DateTimePickerModal';
import { useMarkWatched, useEpisodeHistory, useDeleteHistory } from '../hooks';

interface EpisodeInfoCardProps {
  data: EpisodeDetailData;
  onHistoryClick: () => void;
  isWatched: boolean;
  onRefetch: () => void;
}

function SingleCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12.5L9 17.5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12.5L7 17.5L18 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M6 12.5L11 17.5L22 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 删除确认弹框（多条历史时使用） */
function DeleteHistoryModal({
  entries,
  onConfirm,
  onClose,
}: {
  entries: WatchHistoryEntry[];
  onConfirm: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div
        className="relative z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-foreground mb-1">删除观看记录</h3>
        <p className="text-sm text-muted-foreground mb-4">请选择要删除的观看记录：</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((entry) => {
            const label = entry.watchedAt
              ? new Date(entry.watchedAt).toLocaleString('zh-CN', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })
              : '未知时间';
            return (
              <button
                key={entry.id}
                onClick={() => onConfirm(entry.id)}
                className="w-full text-left px-4 py-3 rounded-xl bg-muted hover:bg-red-500/10 hover:border-red-500/30 border border-border/40 transition-colors text-sm text-foreground"
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export function EpisodeInfoCard({ data, onHistoryClick, isWatched, onRefetch }: EpisodeInfoCardProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  const show = data.show;

  // 面包屑剧名：优先 translatedName，回退 title
  const showDisplayName = show.translatedName ?? show.title;

  const year = data.airDate ? new Date(data.airDate).getFullYear() : '—';
  const runtime = data.runtime || 24;

  const markWatched = useMarkWatched(data.showId, data.seasonNumber, data.episodeNumber);
  const { data: historyEntries = [] } = useEpisodeHistory(data.showId, data.seasonNumber, data.episodeNumber);
  const deleteHistory = useDeleteHistory(data.showId, data.seasonNumber, data.episodeNumber);

  // 单钩：弹出日期选择，确认后标记已观看
  const handleMarkWatched = async (isoString: string) => {
    await markWatched.mutateAsync(isoString);
    setDatePickerOpen(false);
    onRefetch();
  };

  // 双钩：删除观看历史
  const handleUnwatch = async () => {
    if (historyEntries.length === 0) return;
    if (historyEntries.length === 1) {
      await deleteHistory.mutateAsync(historyEntries[0].id);
      onRefetch();
    } else {
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    await deleteHistory.mutateAsync(id);
    setDeleteModalOpen(false);
    onRefetch();
  };

  // 外部链接
  const traktUrl = show.traktSlug
    ? `https://trakt.tv/shows/${show.traktSlug}/seasons/${data.seasonNumber}/episodes/${data.episodeNumber}`
    : null;
  const tmdbUrl = show.tmdbId
    ? `https://www.themoviedb.org/tv/${show.tmdbId}/season/${data.seasonNumber}/episode/${data.episodeNumber}`
    : null;
  const imdbUrl = show.imdbId ? `https://www.imdb.com/title/${show.imdbId}` : null;
  const tvdbUrl = show.tvdbId
    ? `https://thetvdb.com/dereferrer/series/${show.tvdbId}`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── 面包屑 ── */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '20px' }}
        className="text-sm md:text-base"
      >
        <span className="font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer tracking-wide">
          {showDisplayName}
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

      {/* ── Trakt 评分 ── */}
      {data.traktRating != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '40px' }}>
          <div className="flex items-center gap-2.5 cursor-pointer group/star">
            <div className="text-primary group-hover/star:scale-110 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-foreground text-base leading-none mb-0.5">{data.traktRating}%</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trakt</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 简介 ── */}
      {overview && (
        <div style={{ marginBottom: '40px' }}>
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

      {/* ── 外部链接 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
        {imdbUrl && (
          <a
            href={imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f6c700]/10 hover:bg-[#f6c700]/20 border border-[#f6c700]/30 transition-colors"
          >
            <span className="bg-[#f6c700] text-black rounded px-1 py-0.5 font-black text-[10px] tracking-tighter">IMDb</span>
          </a>
        )}
        {tmdbUrl && (
          <a
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#01b4e4]/10 hover:bg-[#01b4e4]/20 border border-[#01b4e4]/30 transition-colors text-[#01b4e4] text-xs font-bold tracking-wide"
          >
            TMDB
          </a>
        )}
        {tvdbUrl && (
          <a
            href={tvdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6cb4ff]/10 hover:bg-[#6cb4ff]/20 border border-[#6cb4ff]/30 transition-colors text-[#6cb4ff] text-xs font-bold tracking-wide"
          >
            TVDB
          </a>
        )}
        {traktUrl && (
          <a
            href={traktUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ed1c24]/10 hover:bg-[#ed1c24]/20 border border-[#ed1c24]/30 transition-colors text-[#ed1c24] text-xs font-bold tracking-wide"
          >
            Trakt
          </a>
        )}
      </div>

      {/* ── 操作栏 ── */}
      <div
        style={{
          paddingTop: '24px',
          borderTop: '1px solid color-mix(in srgb, var(--border) 30%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Watch 按钮 — 固定宽度保持一致 */}
        <button
          onClick={isWatched ? handleUnwatch : () => setDatePickerOpen(true)}
          disabled={markWatched.isPending || deleteHistory.isPending}
          className={[
            'h-12 w-36 flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 shadow-md text-sm font-bold tracking-wide disabled:opacity-60 disabled:cursor-not-allowed',
            isWatched
              ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-900/40'
              : 'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground',
          ].join(' ')}
          aria-label={isWatched ? '取消观看' : '标记为已观看'}
          title={isWatched ? '点击删除观看记录' : '标记为已观看'}
        >
          {isWatched ? <DoubleCheckIcon /> : <SingleCheckIcon />}
          <span>{isWatched ? '已观看' : '标记已观看'}</span>
        </button>

        {/* History 按钮 — 同等宽度 */}
        <button
          onClick={onHistoryClick}
          className="h-12 w-36 bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 text-sm font-bold tracking-wide"
          aria-label="观看历史"
          title="观看历史"
        >
          <Clock size={18} />
          <span>观看历史</span>
        </button>
      </div>

      {/* ── 日期时间选择弹框（未观看 → 标记已观看） ── */}
      <DateTimePickerModal
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={handleMarkWatched}
      />

      {/* ── 多条历史删除选择弹框 ── */}
      {deleteModalOpen && (
        <DeleteHistoryModal
          entries={historyEntries}
          onConfirm={handleDeleteEntry}
          onClose={() => setDeleteModalOpen(false)}
        />
      )}
    </div>
  );
}

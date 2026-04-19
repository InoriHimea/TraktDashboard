import { useState } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12.5L9 17.5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
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

/** 通用二次确认弹框 */
function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmClassName,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[380px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/70 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={[
              'flex-1 h-10 rounded-lg text-sm font-bold transition-colors',
              confirmClassName ?? 'bg-indigo-500 hover:bg-indigo-600 text-white',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EpisodeInfoCard({ data, onHistoryClick, isWatched, onRefetch }: EpisodeInfoCardProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmWatchOpen, setConfirmWatchOpen] = useState(false);
  const [confirmUnwatchOpen, setConfirmUnwatchOpen] = useState(false);

  const overview = data.translatedOverview ?? data.overview;
  const episodeTitle = data.translatedTitle ?? data.title;
  const show = data.show;
  const showDisplayName = show.translatedName ?? show.title;

  const year = data.airDate ? new Date(data.airDate).getFullYear() : '—';
  const runtime = data.runtime || 24;

  const markWatched = useMarkWatched(data.showId, data.seasonNumber, data.episodeNumber);
  const { data: historyEntries = [] } = useEpisodeHistory(data.showId, data.seasonNumber, data.episodeNumber);
  const deleteHistory = useDeleteHistory(data.showId, data.seasonNumber, data.episodeNumber);

  const handleMarkWatched = async (isoString: string) => {
    await markWatched.mutateAsync(isoString);
    setDatePickerOpen(false);
    onRefetch();
  };

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

      {/* ── 标题（渐变多色）── */}
      {episodeTitle && (
        <h1
          style={{ marginBottom: '24px' }}
          className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]"
        >
          {/* 渐变色标题：紫 → 靛蓝 → 天蓝，深色/浅色下都清晰易读 */}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(120deg, #a855f7 0%, #818cf8 45%, #38bdf8 100%)',
            }}
          >
            {episodeTitle}
          </span>
        </h1>
      )}

      {/* ── 元信息行 ── */}
      <p style={{ marginBottom: '28px' }} className="text-muted-foreground text-sm md:text-base font-bold uppercase tracking-widest">
        {year}
        <span className="mx-2 opacity-30">•</span>
        {runtime} mins
        <span className="mx-2 opacity-30">•</span>
        TV-14
        <span className="mx-2 opacity-30">•</span>
        Anime
      </p>

      {/* ── Trakt 评分（精致卡片样式）── */}
      {data.traktRating != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px' }}>
          <div
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-200 cursor-default group/rating"
            style={{
              background: 'color-mix(in srgb, #a855f7 8%, transparent)',
              borderColor: 'color-mix(in srgb, #a855f7 22%, transparent)',
            }}
          >
            {/* 星星 icon */}
            <div
              className="shrink-0 group-hover/rating:scale-110 transition-transform duration-200"
              style={{ color: '#a855f7' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" />
              </svg>
            </div>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-border/50 shrink-0" />

            {/* 分数 + 标签 */}
            <div className="flex flex-col leading-none gap-1">
              <span className="font-black text-foreground text-lg leading-none tabular-nums">
                {data.traktRating}
                <span className="text-sm font-bold text-muted-foreground">%</span>
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'color-mix(in srgb, #a855f7 70%, var(--muted-foreground))' }}
              >
                Trakt Score
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 简介 ── */}
      {overview && (
        <div style={{ marginBottom: '36px' }}>
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

      {/* ── 外部链接（品牌化 Pill 按钮）── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>

        {/* IMDb — 琥珀/黄色系 */}
        {imdbUrl && (
          <a
            href={imdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'color-mix(in srgb, #f5c518 7%, transparent)',
              borderColor: 'color-mix(in srgb, #f5c518 25%, transparent)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #f5c518 16%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #f5c518 45%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 14px color-mix(in srgb, #f5c518 20%, transparent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #f5c518 7%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #f5c518 25%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <span
              className="rounded-[5px] px-1.5 py-0.5 font-black text-[11px] tracking-tight leading-none"
              style={{ background: '#f5c518', color: '#000' }}
            >
              IMDb
            </span>
            <ExternalLink className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: '#f5c518' }} />
          </a>
        )}

        {/* TMDB — 青蓝色系 */}
        {tmdbUrl && (
          <a
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] text-[#01b4e4] text-xs font-bold tracking-wide"
            style={{
              background: 'color-mix(in srgb, #01b4e4 7%, transparent)',
              borderColor: 'color-mix(in srgb, #01b4e4 22%, transparent)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #01b4e4 16%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #01b4e4 45%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 14px color-mix(in srgb, #01b4e4 18%, transparent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #01b4e4 7%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #01b4e4 22%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {/* TMDB 小圆点 logo */}
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6z" opacity="0.4"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              TMDB
            </span>
            <ExternalLink className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
        )}

        {/* TVDB — 靛蓝色系 */}
        {tvdbUrl && (
          <a
            href={tvdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] text-xs font-bold tracking-wide"
            style={{
              color: '#6699ff',
              background: 'color-mix(in srgb, #6699ff 7%, transparent)',
              borderColor: 'color-mix(in srgb, #6699ff 22%, transparent)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #6699ff 16%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #6699ff 45%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 14px color-mix(in srgb, #6699ff 18%, transparent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #6699ff 7%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #6699ff 22%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <span className="flex items-center gap-1">
              {/* TV 小图标 */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 3l-4 4-4-4"/>
              </svg>
              TVDB
            </span>
            <ExternalLink className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
        )}

        {/* Trakt — 红色系 */}
        {traktUrl && (
          <a
            href={traktUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] text-xs font-bold tracking-wide"
            style={{
              color: '#ed1c24',
              background: 'color-mix(in srgb, #ed1c24 7%, transparent)',
              borderColor: 'color-mix(in srgb, #ed1c24 22%, transparent)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #ed1c24 14%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #ed1c24 40%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 14px color-mix(in srgb, #ed1c24 18%, transparent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #ed1c24 7%, transparent)';
              (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, #ed1c24 22%, transparent)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <span className="flex items-center gap-1">
              {/* Trakt 小 checkmark logo */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 13L9 18L20 7"/>
              </svg>
              Trakt
            </span>
            <ExternalLink className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
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
          gap: '10px',
        }}
      >
        {/* ── 已观看 / 标记已观看 按钮 ── */}
        <button
          onClick={isWatched ? () => setConfirmUnwatchOpen(true) : () => setConfirmWatchOpen(true)}
          disabled={markWatched.isPending || deleteHistory.isPending}
          aria-label={isWatched ? '取消观看' : '标记为已观看'}
          title={isWatched ? '点击删除观看记录' : '标记为已观看'}
          className="group relative h-11 flex items-center justify-center gap-2 rounded-xl transition-all duration-200 active:scale-[0.96] text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          style={{
            minWidth: '148px',
            paddingLeft: '20px',
            paddingRight: '20px',
            /* 渐变背景 — 浅色/深色均清晰 */
            background: isWatched
              ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            color: '#fff',
            boxShadow: isWatched
              ? '0 4px 20px color-mix(in srgb, #7c3aed 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 4px 20px color-mix(in srgb, #7c3aed 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
          onMouseEnter={e => {
            if (!isWatched) {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px color-mix(in srgb, #7c3aed 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)';
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)';
            } else {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px color-mix(in srgb, #7c3aed 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)';
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px color-mix(in srgb, #7c3aed 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)';
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
          }}
        >
          {/* 悬停时的高光层 */}
          <span className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-200 rounded-xl" />
          <span className="relative flex items-center gap-2">
            {isWatched ? <DoubleCheckIcon /> : <SingleCheckIcon />}
            <span>{isWatched ? '已观看' : '标记已观看'}</span>
          </span>
        </button>

        {/* ── 观看历史 按钮（毛玻璃/边框风格，浅深色均适配）── */}
        <button
          onClick={onHistoryClick}
          aria-label="观看历史"
          title="观看历史"
          className="group h-11 flex items-center justify-center gap-2 rounded-xl border transition-all duration-200 active:scale-[0.96] text-sm font-bold tracking-wide text-muted-foreground hover:text-foreground"
          style={{
            minWidth: '132px',
            paddingLeft: '18px',
            paddingRight: '18px',
            background: 'color-mix(in srgb, var(--muted) 60%, transparent)',
            borderColor: 'color-mix(in srgb, var(--border) 60%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--muted) 90%, transparent)';
            (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--border) 100%, transparent)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--muted) 60%, transparent)';
            (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--border) 60%, transparent)';
          }}
        >
          <Clock size={16} className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span>观看历史</span>
        </button>
      </div>

      {/* ── 日期时间选择弹框 ── */}
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

      {/* ── 标记已观看二次确认 ── */}
      {confirmWatchOpen && (
        <ConfirmModal
          title="标记为已观看"
          description="确认将此集标记为已观看？你可以在下一步选择观看时间。"
          confirmLabel="继续"
          onConfirm={() => {
            setConfirmWatchOpen(false);
            setDatePickerOpen(true);
          }}
          onClose={() => setConfirmWatchOpen(false)}
        />
      )}

      {/* ── 取消观看二次确认 ── */}
      {confirmUnwatchOpen && (
        <ConfirmModal
          title="取消观看记录"
          description="确认删除此集的观看记录？此操作不可撤销。"
          confirmLabel="删除"
          confirmClassName="bg-red-500 hover:bg-red-600 text-white"
          onConfirm={() => {
            setConfirmUnwatchOpen(false);
            handleUnwatch();
          }}
          onClose={() => setConfirmUnwatchOpen(false)}
        />
      )}
    </div>
  );
}
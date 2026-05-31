import { useState } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import type { EpisodeDetailData, WatchHistoryEntry } from '@trakt-dashboard/types';
import { DateTimePickerModal } from './DateTimePickerModal';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-[420px] max-w-[90vw] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-bold text-foreground">删除观看记录</h3>
        <p className="mb-4 text-sm text-muted-foreground">请选择要删除的观看记录：</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {entries.map((entry) => {
            const label = entry.watchedAt
              ? new Date(entry.watchedAt).toLocaleString('zh-CN', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })
              : '未知时间';
            return (
              <Button
                key={entry.id}
                type="button"
                variant="secondary"
                color="rose"
                size="md"
                onClick={() => {
                  onConfirm(entry.id);
                  onClose();
                }}
                className="w-full justify-start"
              >
                {label}
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          color="slate"
          size="md"
          onClick={onClose}
          className="mt-4 w-full"
        >
          取消
        </Button>
      </div>
    </div>
  );
}

export function EpisodeInfoCard({ data, onHistoryClick, isWatched, onRefetch }: EpisodeInfoCardProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
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
    try {
      await deleteHistory.mutateAsync(id);
      setPendingDeleteId(null);
      setDeleteModalOpen(false);
      onRefetch();
    } catch (err) {
      console.error('Failed to delete history entry:', err);
    }
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
            className="inline-flex items-center gap-3 rounded-xl border transition-all duration-200 cursor-default group/rating"
            style={{
              padding: '8px 14px',
              background: 'rgba(168, 85, 247, 0.10)',
              borderColor: 'rgba(168, 85, 247, 0.32)',
            }}
          >
            {/* 星星 icon */}
            <div
              className="shrink-0 group-hover/rating:scale-110 transition-transform duration-200"
              style={{ color: '#a855f7' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.8214 8.11672L21.5106 8.90983L16.5651 13.4833L17.8779 20.0902L12 16.8L6.12215 20.0902L7.43493 13.4833L2.48944 8.90983L9.17863 8.11672L12 2Z" />
              </svg>
            </div>

            {/* 分隔线 */}
            <div style={{ width: '1px', height: '22px', background: 'rgba(168, 85, 247, 0.25)', flexShrink: 0 }} />

            {/* 分数 + 标签 */}
            <div className="flex flex-col leading-none" style={{ gap: '4px' }}>
              <span className="font-black text-foreground tabular-nums" style={{ fontSize: '17px', lineHeight: 1 }}>
                {data.traktRating}
                <span className="font-bold text-muted-foreground" style={{ fontSize: '12px' }}>%</span>
              </span>
              <span
                className="font-bold uppercase"
                style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'rgba(168, 85, 247, 0.85)' }}
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
            className="text-muted-foreground/80 text-base md:text-lg font-medium max-w-3xl whitespace-pre-line"
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
            href={imdbUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
            style={{ padding: '7px 11px', background: 'rgba(245,197,24,0.09)', borderColor: 'rgba(245,197,24,0.40)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(245,197,24,0.18)'; el.style.borderColor = 'rgba(245,197,24,0.65)'; el.style.boxShadow = '0 0 16px rgba(245,197,24,0.22)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(245,197,24,0.09)'; el.style.borderColor = 'rgba(245,197,24,0.40)'; el.style.boxShadow = 'none'; }}
          >
            <span className="rounded font-black leading-none" style={{ background: '#f5c518', color: '#000', fontSize: '11px', padding: '2px 5px', letterSpacing: '-0.02em' }}>
              IMDb
            </span>
          </a>
        )}

        {/* TMDB — 青蓝色系 */}
        {tmdbUrl && (
          <a
            href={tmdbUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] font-bold"
            style={{ padding: '7px 11px', color: '#01b4e4', fontSize: '12px', letterSpacing: '0.04em', background: 'rgba(1,180,228,0.09)', borderColor: 'rgba(1,180,228,0.38)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(1,180,228,0.18)'; el.style.borderColor = 'rgba(1,180,228,0.62)'; el.style.boxShadow = '0 0 16px rgba(1,180,228,0.20)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(1,180,228,0.09)'; el.style.borderColor = 'rgba(1,180,228,0.38)'; el.style.boxShadow = 'none'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6z" opacity="0.4"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            TMDB
          </a>
        )}

        {/* TVDB — 靛蓝色系 */}
        {tvdbUrl && (
          <a
            href={tvdbUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] font-bold"
            style={{ padding: '7px 11px', color: '#6699ff', fontSize: '12px', letterSpacing: '0.04em', background: 'rgba(102,153,255,0.09)', borderColor: 'rgba(102,153,255,0.38)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(102,153,255,0.18)'; el.style.borderColor = 'rgba(102,153,255,0.62)'; el.style.boxShadow = '0 0 16px rgba(102,153,255,0.20)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(102,153,255,0.09)'; el.style.borderColor = 'rgba(102,153,255,0.38)'; el.style.boxShadow = 'none'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/>
            </svg>
            TVDB
          </a>
        )}

        {/* Trakt — 红色系 */}
        {traktUrl && (
          <a
            href={traktUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 hover:scale-[1.04] active:scale-[0.97] font-bold"
            style={{ padding: '7px 11px', color: '#ed1c24', fontSize: '12px', letterSpacing: '0.04em', background: 'rgba(237,28,36,0.09)', borderColor: 'rgba(237,28,36,0.38)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(237,28,36,0.17)'; el.style.borderColor = 'rgba(237,28,36,0.62)'; el.style.boxShadow = '0 0 16px rgba(237,28,36,0.20)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(237,28,36,0.09)'; el.style.borderColor = 'rgba(237,28,36,0.38)'; el.style.boxShadow = 'none'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M4 13L9 18L20 7"/>
            </svg>
            Trakt
          </a>
        )}
      </div>

      {/* ── 操作栏 ── */}
      <div
        style={{
          paddingTop: '24px',
          borderTop: '1px solid rgba(128,128,128,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <Button
          type="button"
          variant={isWatched ? "secondary" : "primary"}
          color={isWatched ? "emerald" : "violet"}
          size="md"
          loading={markWatched.isPending || deleteHistory.isPending}
          icon={isWatched ? <DoubleCheckIcon /> : <SingleCheckIcon />}
          onClick={isWatched ? () => setConfirmUnwatchOpen(true) : () => setConfirmWatchOpen(true)}
          aria-label={isWatched ? '取消观看' : '标记为已观看'}
          title={isWatched ? '点击删除观看记录' : '标记为已观看'}
          className="w-[152px]"
        >
          {isWatched ? '已观看' : '标记已观看'}
        </Button>

        <Button
          type="button"
          variant="secondary"
          color="slate"
          size="md"
          icon={<Clock size={16} />}
          onClick={onHistoryClick}
          aria-label="观看历史"
          title="观看历史"
          className="w-[152px]"
        >
          观看历史
        </Button>
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
          onConfirm={setPendingDeleteId}
          onClose={() => setDeleteModalOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmWatchOpen}
        title="标记为已观看"
        description="确认将此集标记为已观看？你可以在下一步选择观看时间。"
        confirmText="继续"
        confirmColor="violet"
        cancelText="取消"
        onConfirm={() => {
          setConfirmWatchOpen(false);
          setDatePickerOpen(true);
        }}
        onCancel={() => setConfirmWatchOpen(false)}
      />

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="删除观看记录"
        description="确认删除这条观看记录？此操作不可撤销。"
        confirmText="删除"
        confirmColor="rose"
        cancelText="取消"
        isLoading={deleteHistory.isPending}
        onConfirm={async () => {
          if (pendingDeleteId !== null) {
            await handleDeleteEntry(pendingDeleteId);
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />

      <ConfirmDialog
        isOpen={confirmUnwatchOpen}
        title="取消观看记录"
        description="确认删除此集的观看记录？此操作不可撤销。"
        confirmText="删除"
        confirmColor="rose"
        cancelText="取消"
        isLoading={deleteHistory.isPending}
        onConfirm={async () => {
          try {
            await handleUnwatch();
            setConfirmUnwatchOpen(false);
          } catch (err) {
            console.error('Failed to unwatch:', err);
          }
        }}
        onCancel={() => setConfirmUnwatchOpen(false)}
      />
    </div>
  );
}
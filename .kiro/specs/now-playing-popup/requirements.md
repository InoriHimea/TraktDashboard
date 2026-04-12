# Requirements Document

## Introduction

本功能在 Web 前端新增一个"正在播放"弹出卡片（Now Playing Popup），通过调用 Trakt API 的 `/users/me/watching` 接口，实时获取当前用户正在观看的剧集信息，并以浮层形式展示在页面中。卡片包含剧集封面图、季/集编号、剧集标题、剩余时间及播放进度条，让用户无需离开当前页面即可了解播放状态。

## Glossary

- **NowPlayingPopup**: 展示当前正在播放剧集信息的浮层卡片组件
- **Trakt_API**: Trakt 提供的 REST API，用于获取用户观看数据
- **WatchingEndpoint**: Trakt API 的 `/users/me/watching` 接口，返回用户当前正在观看的内容
- **NowPlayingData**: 从 WatchingEndpoint 获取的正在播放数据，包含剧集、节目及进度信息
- **ProgressBar**: 展示播放进度的水平条形组件
- **Popup**: 浮层/弹出层，覆盖在页面内容之上的 UI 元素
- **Trigger**: 触发 Popup 显示的 UI 元素（如导航栏中的按钮或图标）
- **PollInterval**: 轮询间隔，NowPlayingPopup 定期刷新数据的时间间隔
- **Backend_Proxy**: 后端 API 路由，代理前端对 Trakt API 的请求以保护用户 token

---

## Requirements

### Requirement 1: 后端代理接口

**User Story:** As a developer, I want a backend proxy endpoint for the Trakt watching status, so that the frontend can fetch now-playing data without exposing user tokens to the client.

#### Acceptance Criteria

1. THE Backend_Proxy SHALL expose a `GET /api/trakt/watching` endpoint that returns the current user's watching status from the Trakt_API WatchingEndpoint.
2. WHEN the user is not currently watching anything, THE Backend_Proxy SHALL return a response with `data: null`.
3. WHEN the Trakt_API returns a 204 status (not watching), THE Backend_Proxy SHALL return `{ data: null }` with HTTP 200.
4. IF the user is not authenticated, THEN THE Backend_Proxy SHALL return HTTP 401.
5. IF the Trakt_API request fails, THEN THE Backend_Proxy SHALL return HTTP 502 with a descriptive error message.
6. THE Backend_Proxy SHALL include the episode's `expires_at` field from the Trakt_API response to enable remaining-time calculation.

---

### Requirement 2: 前端数据获取 Hook

**User Story:** As a frontend developer, I want a React hook that polls the now-playing endpoint, so that the NowPlayingPopup always shows up-to-date data.

#### Acceptance Criteria

1. THE `useNowPlaying` hook SHALL poll `GET /api/trakt/watching` at a PollInterval of 30 seconds.
2. WHEN the returned `data` is non-null, THE `useNowPlaying` hook SHALL expose the NowPlayingData including show title, season number, episode number, episode title, poster path, and `expires_at`.
3. WHEN the returned `data` is null, THE `useNowPlaying` hook SHALL expose `isWatching: false`.
4. WHILE the fetch is in progress, THE `useNowPlaying` hook SHALL expose `isLoading: true`.
5. IF the fetch fails, THEN THE `useNowPlaying` hook SHALL expose the error and retain the last successful data.
6. THE `useNowPlaying` hook SHALL use `staleTime` of 25 seconds to avoid redundant network requests within the same PollInterval.

---

### Requirement 3: NowPlayingPopup 组件展示

**User Story:** As a user, I want to see a popup card showing what I'm currently watching on Trakt, so that I can quickly check my playback status without leaving the page.

#### Acceptance Criteria

1. THE NowPlayingPopup SHALL display a "Now Playing" title label at the top of the card.
2. THE NowPlayingPopup SHALL display the show's poster image; IF the poster image fails to load, THEN THE NowPlayingPopup SHALL display a placeholder icon.
3. THE NowPlayingPopup SHALL display the season and episode number in the format `S{N}·E{N}`.
4. THE NowPlayingPopup SHALL display the episode title, truncated with an ellipsis when it exceeds the available width.
5. THE NowPlayingPopup SHALL display the remaining playback time in minutes, calculated from the `expires_at` field, in the format `{N} min remaining`.
6. THE NowPlayingPopup SHALL display a ProgressBar reflecting the elapsed playback percentage, calculated from the episode runtime and remaining time.
7. WHEN `isWatching` is false, THE NowPlayingPopup SHALL NOT be visible.
8. WHEN `isLoading` is true and no prior data exists, THE NowPlayingPopup SHALL display a loading skeleton in place of the content.

---

### Requirement 4: Popup 触发与交互

**User Story:** As a user, I want to open and close the Now Playing popup from the navigation bar, so that I can access it from any page without disrupting my workflow.

#### Acceptance Criteria

1. THE TopNav SHALL display a "Now Playing" Trigger button WHEN `isWatching` is true.
2. WHEN the Trigger is clicked, THE NowPlayingPopup SHALL toggle between visible and hidden states.
3. WHEN the NowPlayingPopup is visible and the user clicks outside the card, THE NowPlayingPopup SHALL close.
4. WHEN the NowPlayingPopup is visible and the user presses the Escape key, THE NowPlayingPopup SHALL close.
5. THE Trigger button SHALL display a pulsing animation indicator WHEN `isWatching` is true, to draw attention to active playback.
6. WHEN `isWatching` is false, THE TopNav SHALL NOT display the Trigger button.

---

### Requirement 5: 动画与视觉效果

**User Story:** As a user, I want the popup to appear and disappear with smooth animations, so that the experience feels polished and non-jarring.

#### Acceptance Criteria

1. WHEN the NowPlayingPopup transitions from hidden to visible, THE NowPlayingPopup SHALL animate with a fade-in and upward slide motion.
2. WHEN the NowPlayingPopup transitions from visible to hidden, THE NowPlayingPopup SHALL animate with a fade-out and downward slide motion.
3. THE NowPlayingPopup SHALL use the existing project CSS variables (`--color-surface`, `--color-border`, `--color-text`, etc.) for all color values.
4. THE ProgressBar within the NowPlayingPopup SHALL use a gradient fill consistent with the project's existing ProgressBar color palette.
5. THE NowPlayingPopup SHALL be positioned as a fixed overlay anchored near the Trigger button, with a z-index above the TopNav.

---

### Requirement 6: 类型定义

**User Story:** As a developer, I want TypeScript types for the now-playing data, so that the codebase remains type-safe.

#### Acceptance Criteria

1. THE `@trakt-dashboard/types` package SHALL export a `NowPlayingEpisode` interface containing: `show` (title, posterPath, traktSlug), `episode` (seasonNumber, episodeNumber, title), `expiresAt` (ISO string), and `runtime` (minutes, nullable).
2. THE `useNowPlaying` hook return type SHALL reference `NowPlayingEpisode` for the data field.
3. THE NowPlayingPopup component props SHALL accept `NowPlayingEpisode | null` as the `data` prop.

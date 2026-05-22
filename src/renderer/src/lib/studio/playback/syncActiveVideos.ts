import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import {
  clipPoolKey,
  ensurePoolVideoForClip,
} from "@/lib/studio/playback/videoPool";
import {
  resolveClipsAtTime,
  resolveClipsAtTimeSorted,
} from "./resolveClipsAtTime";

export function clipMediaTimeSec(clip: StudioClipResponse, playheadSec: number): number {
  const mediaStart = clip.media_start_sec ?? 0;
  return Math.max(0, playheadSec - clip.start_sec + mediaStart);
}

export interface SyncPoolVideosOptions {
  isPlaying: boolean;
  /** 当前 leader clip id；leader 的 currentTime / muted 由 hook 独占管理。 */
  leaderClipId?: number | null;
  /** 已预排序的 tracks（参见 sortTracksForRender），高频调用避免每次重复 sort。 */
  sortedTracks?: StudioTimelineTrackResponse[];
}

/** 拖动 / 暂停态校准阈值：略大于 1 帧，保证拖 playhead 时画面立即跟随。 */
const POOL_PAUSED_SEEK_EPS = 0.02;
/**
 * 播放态校准阈值：略大于浏览器 video clock 漂移与 RAF 抖动的累积幅度。
 * 高于此值才主动写 currentTime；否则让 pool 视频依赖自身时钟自播，避免每帧 seek 把
 * readyState 拖低至 HAVE_METADATA(1)，导致 canvas 跳过该 layer 不画。
 */
const POOL_PLAYING_DRIFT_THRESHOLD = 0.3;

/**
 * 同步当前时刻 active 视频 clip 对应的 pool 元素（每 clip 独立 video）：
 *
 * - leader clip：跳过 currentTime 与 muted 维护（由 hook 的 setLeader 独占）。
 * - 非 leader：强制 muted=true，drift 超阈值才 seek，按 isPlaying 起播/暂停。
 * - 非 active 的 pool 视频统一 pause。
 */
export async function syncPoolVideos(
  tracks: StudioTimelineTrackResponse[],
  playheadSec: number,
  pool: Map<string, HTMLVideoElement>,
  options: SyncPoolVideosOptions
): Promise<void> {
  const { isPlaying, leaderClipId, sortedTracks } = options;
  const layers = sortedTracks
    ? resolveClipsAtTimeSorted(sortedTracks, playheadSec)
    : resolveClipsAtTime(tracks, playheadSec);
  const activeKeys = new Set<string>();

  const videoClips: StudioClipResponse[] = [];
  for (const { clip } of layers) {
    if (clip.media_type !== "video" || !clip.media_url) continue;
    activeKeys.add(clipPoolKey(clip));
    videoClips.push(clip);
  }

  const videos = await Promise.all(
    videoClips.map((clip) => ensurePoolVideoForClip(pool, clip).catch(() => null))
  );

  for (let i = 0; i < videoClips.length; i++) {
    const video = videos[i];
    if (!video) continue;
    const clip = videoClips[i]!;
    const target = clipMediaTimeSec(clip, playheadSec);
    const isLeader = leaderClipId != null && clip.id === leaderClipId;

    if (!isLeader) {
      if (!video.muted) video.muted = true;
      const drift = Math.abs(video.currentTime - target);
      const playingFreely = isPlaying && !video.paused;
      const driftThreshold = playingFreely
        ? POOL_PLAYING_DRIFT_THRESHOLD
        : POOL_PAUSED_SEEK_EPS;
      if (drift > driftThreshold) {
        video.currentTime = target;
      }
    }

    if (isPlaying) {
      if (video.paused) {
        void video.play().catch(() => {
          if (!video.muted) {
            video.muted = true;
            void video.play().catch(() => undefined);
          }
        });
      }
    } else if (!video.paused) {
      video.pause();
    }
  }

  for (const [key, video] of pool) {
    if (activeKeys.has(key)) continue;
    if (!video.paused) video.pause();
  }
}

/** RAF 热路径用：当前活动 video clip 的 pool key 集合。 */
export function resolveActiveVideoClipKeysSorted(
  sortedTracks: StudioTimelineTrackResponse[],
  playheadSec: number
): Set<string> {
  const keys = new Set<string>();
  for (const { clip } of resolveClipsAtTimeSorted(sortedTracks, playheadSec)) {
    if (clip.media_type === "video" && clip.media_url) {
      keys.add(clipPoolKey(clip));
    }
  }
  return keys;
}

/** 预热阶段触发 seek 的阈值：currentTime 偏离 mediaStart 超过此值才校准。 */
const PRELOAD_SEEK_EPS = 0.1;

/**
 * 预热即将进入时间线的视频 clip（按 clip 实例），避免 leader 切换时 load / seek 空窗。
 */
export function preloadUpcomingVideos(
  tracks: StudioTimelineTrackResponse[],
  pool: Map<string, HTMLVideoElement>,
  playheadSec: number,
  lookaheadSec: number,
  activeKeys: Set<string>
): void {
  const horizon = playheadSec + lookaheadSec;
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (clip.status !== "active") continue;
      if (clip.media_type !== "video" || !clip.media_url) continue;
      if (clip.start_sec <= playheadSec) continue;
      if (clip.start_sec > horizon) continue;
      const key = clipPoolKey(clip);
      if (activeKeys.has(key)) continue;
      const targetMediaStart = clip.media_start_sec ?? 0;
      const known = pool.get(key);
      if (!known) {
        void ensurePoolVideoForClip(pool, clip)
          .then((v) => {
            if (
              v.paused &&
              Math.abs(v.currentTime - targetMediaStart) > PRELOAD_SEEK_EPS
            ) {
              v.currentTime = targetMediaStart;
            }
          })
          .catch(() => undefined);
      } else if (known.paused) {
        if (Math.abs(known.currentTime - targetMediaStart) > PRELOAD_SEEK_EPS) {
          known.currentTime = targetMediaStart;
        }
      }
    }
  }
}

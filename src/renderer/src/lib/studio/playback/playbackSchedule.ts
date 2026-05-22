import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import { isPlaceholderClip } from "@/lib/studio/studioClipUtils";
import { clipEffectiveEndSec, resolveTopVideoClipAtTime } from "./resolveClipsAtTime";

const EPS = 0.001;

export type PlaybackDriver = "video" | "clock";

/** 时间轴上占位的 active clip（含 empty、无 url 的图片等） */
export function isActiveTimelineClip(clip: StudioClipResponse): boolean {
  return clip.status === "active";
}

/** 是否有可展示媒体（导出等场景；不参与播放终点） */
export function hasSchedulableContent(clip: StudioClipResponse): boolean {
  if (clip.status !== "active") return false;
  if (isPlaceholderClip(clip)) return false;
  if (clip.media_type === "video" || clip.media_type === "image") {
    return Boolean(clip.media_url);
  }
  if (clip.media_type === "text") {
    return Boolean(clip.text_content?.trim() || clip.title?.trim());
  }
  return Boolean(clip.media_url || clip.text_content?.trim());
}

/** 所有 active 时间轴 clip，按 start_sec 排序 */
export function flattenActiveTimelineClips(
  tracks: StudioTimelineTrackResponse[]
): StudioClipResponse[] {
  return tracks
    .flatMap((t) => t.clips ?? [])
    .filter(isActiveTimelineClip)
    .sort((a, b) => a.start_sec - b.start_sec);
}

/** 收集有可展示媒体的 clip，按 start_sec 排序 */
export function flattenSchedulableClips(
  tracks: StudioTimelineTrackResponse[]
): StudioClipResponse[] {
  return tracks
    .flatMap((t) => t.clips ?? [])
    .filter(hasSchedulableContent)
    .sort((a, b) => a.start_sec - b.start_sec);
}

/** 下一时间线边界（任一 active clip 的 start / end，取大于 afterSec 的最小值） */
export function findNextTimelineBoundary(
  tracks: StudioTimelineTrackResponse[],
  afterSec: number
): number | null {
  const boundaries: number[] = [];
  for (const clip of flattenActiveTimelineClips(tracks)) {
    if (clip.start_sec > afterSec + EPS) boundaries.push(clip.start_sec);
    const end = clipEffectiveEndSec(clip);
    if (end > afterSec + EPS) boundaries.push(end);
  }
  if (boundaries.length === 0) return null;
  return Math.min(...boundaries);
}

/** 播放终点：全部 active clip 的最晚结束时间（含 empty、无 url 占位） */
export function getContentEndSec(tracks: StudioTimelineTrackResponse[]): number {
  const clips = flattenActiveTimelineClips(tracks);
  if (!clips.length) return 0;
  return Math.max(...clips.map((c) => clipEffectiveEndSec(c)));
}

/** 当前时刻是否应由视频元素驱动播放头 */
export function resolvePlaybackDriver(
  tracks: StudioTimelineTrackResponse[],
  timeSec: number
): PlaybackDriver {
  const layer = resolveTopVideoClipAtTime(tracks, timeSec);
  if (layer?.clip.media_url) return "video";
  return "clock";
}

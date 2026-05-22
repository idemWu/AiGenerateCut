import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import { isPlaceholderClip } from "@/lib/studio/studioClipUtils";

export interface TrackClipAtTime {
  track: StudioTimelineTrackResponse;
  clip: StudioClipResponse;
}

const TIME_EPS = 0.001;

/** clip 在时间线上的有效结束秒（兼容 end_sec 未正确回填） */
export function clipEffectiveEndSec(clip: StudioClipResponse): number {
  if (clip.end_sec > clip.start_sec + TIME_EPS) return clip.end_sec;
  return clip.start_sec + Math.max(clip.duration_sec, TIME_EPS);
}

export function isClipActiveAtTime(clip: StudioClipResponse, timeSec: number): boolean {
  if (clip.status !== "active") return false;
  return timeSec >= clip.start_sec && timeSec < clipEffectiveEndSec(clip);
}

/** 按绘制顺序返回当前时刻各轨 active clip（底→顶：sort_order 越大越靠下，越小越靠上） */
export function resolveClipsAtTime(
  tracks: StudioTimelineTrackResponse[],
  timeSec: number
): TrackClipAtTime[] {
  const sorted = [...tracks].sort((a, b) => b.sort_order - a.sort_order);
  return resolveClipsAtTimeSorted(sorted, timeSec);
}

/** 入参已按绘制顺序排序时直接使用；导出热路径调用千百次时避免每帧重复 sort。 */
export function resolveClipsAtTimeSorted(
  sortedTracks: StudioTimelineTrackResponse[],
  timeSec: number
): TrackClipAtTime[] {
  const result: TrackClipAtTime[] = [];
  for (const track of sortedTracks) {
    const clip = (track.clips ?? []).find((c) => isClipActiveAtTime(c, timeSec));
    if (clip) {
      result.push({ track, clip });
    }
  }
  return result;
}

/** 按导出绘制顺序排序的 tracks（底→顶），结果可重复用于每帧。 */
export function sortTracksForRender(
  tracks: StudioTimelineTrackResponse[]
): StudioTimelineTrackResponse[] {
  return [...tracks].sort((a, b) => b.sort_order - a.sort_order);
}

/** 取叠层最上方的视频 clip（用于单 video 元素驱动） */
export function resolveTopVideoClipAtTime(
  tracks: StudioTimelineTrackResponse[],
  timeSec: number
): TrackClipAtTime | null {
  const layers = resolveClipsAtTime(tracks, timeSec);
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!;
    if (layer.clip.media_type === "video" && layer.clip.media_url) {
      return layer;
    }
  }
  return null;
}

export function isTextLikeClip(clip: StudioClipResponse): boolean {
  return isPlaceholderClip(clip);
}

/** 预览用：将选中 clip 移到绘制栈顶（不改变导出叠层顺序） */
export function promoteSelectedClipLayer(
  layers: TrackClipAtTime[],
  selectedClipId: number | null
): TrackClipAtTime[] {
  if (selectedClipId == null) return layers;
  const index = layers.findIndex((l) => l.clip.id === selectedClipId);
  if (index < 0 || index === layers.length - 1) return layers;
  const next = [...layers];
  const [picked] = next.splice(index, 1);
  if (picked) next.push(picked);
  return next;
}

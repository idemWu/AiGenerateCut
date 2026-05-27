import type {
  CreateStudioKeyframeRequest,
  StudioClipResponse,
  StudioTimelineTrackResponse,
} from "@/lib/api/studio";
import { clipMediaTimeSec } from "@/lib/studio/playback/syncActiveVideos";
import {
  isClipActiveAtTime,
  resolveTopVideoClipAtTime,
} from "@/lib/studio/playback/resolveClipsAtTime";

function canLinkScreenshot(clip: StudioClipResponse): boolean {
  return typeof clip.id === "number" && clip.id > 0;
}

/** 解析摄像机截帧应关联的 clip（用于 screenshot 四字段）。 */
export function resolveKeyframeSourceClip(
  tracks: StudioTimelineTrackResponse[],
  playheadSec: number,
  selectedClip: StudioClipResponse | null | undefined
): StudioClipResponse | null {
  if (selectedClip && isClipActiveAtTime(selectedClip, playheadSec) && canLinkScreenshot(selectedClip)) {
    return selectedClip;
  }

  const topVideo = resolveTopVideoClipAtTime(tracks, playheadSec);
  if (topVideo && canLinkScreenshot(topVideo.clip)) {
    return topVideo.clip;
  }

  return null;
}

export function buildCreateKeyframeRequest(
  imageUrl: string,
  sourceClip: StudioClipResponse | null,
  playheadSec: number
): CreateStudioKeyframeRequest {
  if (sourceClip && canLinkScreenshot(sourceClip)) {
    return {
      source_type: "screenshot",
      object_url: imageUrl,
      source_clip_id: sourceClip.id,
      source_time_sec: clipMediaTimeSec(sourceClip, playheadSec),
    };
  }

  return {
    source_type: "upload",
    object_url: imageUrl,
  };
}

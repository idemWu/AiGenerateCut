import type { components } from "@/lib/api/schema";
import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import { clipMediaTimeSec } from "@/lib/studio/playback/syncActiveVideos";
import {
  isClipActiveAtTime,
  resolveTopVideoClipAtTime,
} from "@/lib/studio/playback/resolveClipsAtTime";

type CreateStudioKeyframeRequest = components["schemas"]["CreateStudioKeyframeRequest"];

function canLinkScreenshot(clip: StudioClipResponse): boolean {
  const outputId = clip.workflow_node_output_id;
  return (
    typeof clip.workflow_id === "number" &&
    clip.workflow_id > 0 &&
    typeof outputId === "number" &&
    outputId > 0
  );
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
    const outputId = sourceClip.workflow_node_output_id;
    return {
      source_type: "screenshot",
      image_url: imageUrl,
      source_workflow_id: sourceClip.workflow_id,
      source_output_id: outputId as number,
      source_time_sec: clipMediaTimeSec(sourceClip, playheadSec),
    };
  }

  return {
    source_type: "upload",
    image_url: imageUrl,
  };
}

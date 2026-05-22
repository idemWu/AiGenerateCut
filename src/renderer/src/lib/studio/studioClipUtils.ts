import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";

export type StudioAiContextMode = "create" | "clip" | "workflow";

/** 无 media_url 的时间线占位（source_type=empty → media_type=text，或历史误标 image） */
export function isPlaceholderClip(clip: StudioClipResponse): boolean {
  if (clip.media_url) return false;
  if (clip.media_type === "video") return false;
  return (
    clip.media_type === "text" ||
    clip.media_type === "empty" ||
    clip.media_type === "image"
  );
}

/** 已保存的正文（不含占位、不含 title） */
export function getClipTextContent(clip: StudioClipResponse): string | null {
  const content = clip.text_content?.trim();
  return content || null;
}

/** 预览画布展示文案：仅 text_content，空则用占位提示 */
export function getClipPreviewText(clip: StudioClipResponse, emptyPlaceholder: string): string {
  return getClipTextContent(clip) ?? emptyPlaceholder;
}

/** @deprecated 使用 getClipTextContent / getClipPreviewText */
export function getPlaceholderClipLabel(clip: StudioClipResponse): string {
  return clip.text_content?.trim() || "";
}

export function findClipInTracks(
  tracks: StudioTimelineTrackResponse[],
  clipId: number | null
): StudioClipResponse | null {
  if (clipId == null) return null;
  for (const track of tracks) {
    const clip = (track.clips ?? []).find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}

export function deriveStudioAiContextMode(
  selectedClip: StudioClipResponse | null,
  activeWorkflowId: number | null
): StudioAiContextMode {
  if (selectedClip) return "clip";
  if (activeWorkflowId != null) return "workflow";
  return "create";
}

export function resolveStudioAiWorkflowId(
  selectedClip: StudioClipResponse | null,
  activeWorkflowId: number | null
): number | null {
  if (selectedClip) return selectedClip.workflow_id;
  return activeWorkflowId;
}

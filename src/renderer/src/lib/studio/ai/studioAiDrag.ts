import type { StudioAiReferenceSource } from "@/lib/studio/studioAiResources";

export const STUDIO_AI_DRAG_MIME =
  "application/vnd.movie-utopia.studio-ai-ref+json";

export interface StudioAiDragPayload {
  source: StudioAiReferenceSource;
  label: string;
  thumbUrl?: string | null;
}

export function setStudioAiDragData(
  dataTransfer: DataTransfer,
  payload: StudioAiDragPayload
): void {
  const json = JSON.stringify(payload);
  dataTransfer.setData(STUDIO_AI_DRAG_MIME, json);
  dataTransfer.setData("text/plain", payload.label);
  dataTransfer.effectAllowed = "copy";
}

export function parseStudioAiDragData(
  dataTransfer: DataTransfer
): StudioAiDragPayload | null {
  const raw = dataTransfer.getData(STUDIO_AI_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StudioAiDragPayload;
    if (!parsed?.source || !parsed.label) return null;
    return parsed;
  } catch {
    return null;
  }
}

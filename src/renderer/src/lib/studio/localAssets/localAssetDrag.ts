import type { LocalAssetMediaType } from "./types";

export const STUDIO_LOCAL_ASSET_DRAG_MIME =
  "application/vnd.movie-utopia.studio-local-asset+json";

export interface LocalAssetDragPayload {
  assetId: string;
  name: string;
  mediaType: LocalAssetMediaType;
  durationSec?: number;
}

export function setLocalAssetDragData(
  dataTransfer: DataTransfer,
  payload: LocalAssetDragPayload
): void {
  dataTransfer.setData(STUDIO_LOCAL_ASSET_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData("text/plain", payload.name);
  dataTransfer.effectAllowed = "copy";
}

export function parseLocalAssetDragData(
  dataTransfer: DataTransfer
): LocalAssetDragPayload | null {
  const raw = dataTransfer.getData(STUDIO_LOCAL_ASSET_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalAssetDragPayload;
    if (!parsed.assetId || !parsed.name) return null;
    if (parsed.mediaType !== "image" && parsed.mediaType !== "video") return null;
    return parsed;
  } catch {
    return null;
  }
}

import {
  createStudioClip,
  type StudioClipResponse,
} from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import { getLocalMediaAsset, setLocalMediaDuration } from "./localAssetsApi";
import type { LocalAsset } from "./types";
import type { LocalAssetDragPayload } from "./localAssetDrag";
import { localAssetProtocolUrl, makeLocalAssetObjectKey } from "./localAssetUrl";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

interface CreateLocalAssetClipParams {
  projectId: number;
  payload: LocalAssetDragPayload;
  startSec: number;
  aspectRatio: StudioAspectRatio;
}

function clampTimelineDuration(durationSec: number | undefined): number {
  return Math.min(Math.max(durationSec ?? 5, 1), 60);
}

function loadLocalVideoDuration(assetId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.crossOrigin = STUDIO_MEDIA_CROSS_ORIGIN;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Invalid video duration"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to read video metadata"));
    };
    video.src = localAssetProtocolUrl(assetId);
  });
}

async function resolveLocalAssetForClip(
  projectId: number,
  payload: LocalAssetDragPayload
): Promise<LocalAsset> {
  const asset = await getLocalMediaAsset(projectId, payload.assetId);
  if (!asset?.exists) {
    throw new Error("Local media file is missing");
  }
  return asset;
}

export async function createLocalAssetClip(
  params: CreateLocalAssetClipParams
): Promise<StudioClipResponse> {
  const { projectId, payload, startSec, aspectRatio } = params;
  const asset = await resolveLocalAssetForClip(projectId, payload);

  let sourceDurationSec = asset.durationSec ?? payload.durationSec;
  if (asset.mediaType === "video" && !sourceDurationSec) {
    sourceDurationSec = await loadLocalVideoDuration(asset.id);
    await setLocalMediaDuration(projectId, asset.id, sourceDurationSec);
  }

  return createStudioClip(projectId, {
    source_type: "upload",
    media_type: asset.mediaType,
    object_key: makeLocalAssetObjectKey(asset.id),
    start_sec: startSec,
    duration_sec: asset.mediaType === "video" ? clampTimelineDuration(sourceDurationSec) : 3,
    source_duration_sec: asset.mediaType === "video" ? sourceDurationSec : undefined,
    aspect_ratio: aspectRatio,
    title: asset.name,
  });
}

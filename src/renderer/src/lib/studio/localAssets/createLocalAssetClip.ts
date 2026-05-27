import {
  createStudioClip,
  type StudioAspectRatio,
  type StudioClipResponse,
} from "@/lib/api/studio";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import { getLocalMediaAsset, setLocalMediaDuration } from "./localAssetsApi";
import type { LocalAsset } from "./types";
import type { LocalAssetDragPayload } from "./localAssetDrag";
import { localAssetProtocolUrl, makeLocalAssetObjectKey } from "./localAssetUrl";

interface CreateLocalAssetClipParams {
  projectId: number;
  payload: LocalAssetDragPayload;
  startSec: number;
  aspectRatio: StudioAspectRatio;
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
    object_url: makeLocalAssetObjectKey(asset.id),
    mime_type: asset.mediaType === "video" ? "video/mp4" : "image/png",
    start_sec: startSec,
    aspect_ratio: aspectRatio,
    title: asset.name,
  });
}

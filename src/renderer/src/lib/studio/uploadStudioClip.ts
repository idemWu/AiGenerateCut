import { createStudioClip, type StudioClipResponse } from "@/lib/api/studio";
import { getUploadUrl, uploadAiResourceImage, uploadToR2 } from "@/lib/api/upload";
import type { components } from "@/lib/api/schema";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

export interface UploadStudioClipParams {
  projectId: number;
  playheadSec: number;
  aspectRatio: StudioAspectRatio;
  file: File;
}

function getVideoDurationFromFile(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Invalid video duration"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read video metadata"));
    };
    video.src = url;
  });
}

/** 上传素材并在播放头位置创建 upload clip */
export async function uploadStudioClipAtPlayhead(
  params: UploadStudioClipParams
): Promise<StudioClipResponse> {
  const { projectId, playheadSec, aspectRatio, file } = params;
  const isVideo = file.type.startsWith("video/");

  let publicUrl: string;
  let sourceDurationSec: number | undefined;

  if (isVideo) {
    const { upload_url, public_url } = await getUploadUrl(
      "ai_resource_video",
      file.name,
      file.type
    );
    await uploadToR2(upload_url, file, file.type);
    publicUrl = public_url;
    try {
      sourceDurationSec = await getVideoDurationFromFile(file);
    } catch {
      sourceDurationSec = undefined;
    }
  } else {
    publicUrl = await uploadAiResourceImage(file);
  }

  const durationSec = isVideo
    ? Math.min(Math.max(sourceDurationSec ?? 5, 1), 60)
    : 3;

  return createStudioClip(projectId, {
    source_type: "upload",
    start_sec: playheadSec,
    duration_sec: durationSec,
    media_type: isVideo ? "video" : "image",
    object_key: publicUrl,
    source_duration_sec: isVideo ? sourceDurationSec : undefined,
    aspect_ratio: aspectRatio,
  });
}

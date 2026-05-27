import { createStudioClip, type StudioClipResponse } from "@/lib/api/studio";
import { getUploadUrl, uploadAiResourceImage, uploadToR2 } from "@/lib/api/upload";
import type { StudioAspectRatio } from "@/lib/api/studio";

export interface UploadStudioClipParams {
  projectId: number;
  playheadSec: number;
  aspectRatio: StudioAspectRatio;
  file: File;
}

/** 上传素材并在播放头位置创建 upload clip */
export async function uploadStudioClipAtPlayhead(
  params: UploadStudioClipParams
): Promise<StudioClipResponse> {
  const { projectId, playheadSec, aspectRatio, file } = params;
  const isVideo = file.type.startsWith("video/");

  let publicUrl: string;
  if (isVideo) {
    const { upload_url, public_url } = await getUploadUrl(
      "ai_resource_video",
      file.name,
      file.type
    );
    await uploadToR2(upload_url, file, file.type);
    publicUrl = public_url;
  } else {
    publicUrl = await uploadAiResourceImage(file);
  }

  return createStudioClip(projectId, {
    start_sec: playheadSec,
    object_url: publicUrl,
    mime_type: file.type || (isVideo ? "video/mp4" : "image/png"),
    aspect_ratio: aspectRatio,
  });
}

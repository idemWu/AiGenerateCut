import { createStudioKeyframe, type StudioClipResponse, type StudioKeyframeResponse } from "@/lib/api/studio";
import { getUploadUrl, uploadToR2 } from "@/lib/api/upload";
import { buildCreateKeyframeRequest } from "@/lib/studio/buildCreateKeyframeRequest";

export interface UploadStudioKeyframeParams {
  projectId: number;
  blob: Blob;
  playheadSec: number;
  sourceClip?: StudioClipResponse | null;
}

export async function uploadStudioKeyframeFromBlob(
  params: UploadStudioKeyframeParams
): Promise<StudioKeyframeResponse> {
  const { projectId, blob, playheadSec, sourceClip = null } = params;
  const filename = `keyframe-${Date.now()}.png`;
  const { upload_url, public_url } = await getUploadUrl(
    "ai_resource_image",
    filename,
    "image/png"
  );
  await uploadToR2(upload_url, blob, "image/png");

  return createStudioKeyframe(
    projectId,
    buildCreateKeyframeRequest(public_url, sourceClip, playheadSec)
  );
}

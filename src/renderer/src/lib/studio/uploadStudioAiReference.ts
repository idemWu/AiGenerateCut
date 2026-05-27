import { createStudioResource } from "@/lib/api/studio";
import { getUploadUrl, uploadAiResourceImage, uploadToR2 } from "@/lib/api/upload";

export async function uploadStudioAiReferenceFile(
  file: File,
  projectId?: number
): Promise<{ objectKey: string; mediaType: "image" | "video"; resourceId?: number }> {
  const isVideo = file.type.startsWith("video/");
  if (isVideo) {
    const contentType = file.type || "video/mp4";
    const { upload_url, public_url } = await getUploadUrl(
      "ai_resource_video",
      file.name || "reference.mp4",
      contentType
    );
    await uploadToR2(upload_url, file, contentType);
    const resource = projectId
      ? await createStudioResource({
          object_url: public_url,
          project_id: projectId,
          resource_type: "video",
        })
      : null;
    return { objectKey: public_url, mediaType: "video", resourceId: resource?.id };
  }

  const publicUrl = await uploadAiResourceImage(file);
  const resource = projectId
    ? await createStudioResource({
        object_url: publicUrl,
        project_id: projectId,
        resource_type: "image",
      })
    : null;
  return { objectKey: publicUrl, mediaType: "image", resourceId: resource?.id };
}

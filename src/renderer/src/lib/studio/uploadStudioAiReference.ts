import { getUploadUrl, uploadAiResourceImage, uploadToR2 } from "@/lib/api/upload";

export async function uploadStudioAiReferenceFile(
  file: File
): Promise<{ objectKey: string; mediaType: "image" | "video" }> {
  const isVideo = file.type.startsWith("video/");
  if (isVideo) {
    const contentType = file.type || "video/mp4";
    const { upload_url, public_url } = await getUploadUrl(
      "ai_resource_video",
      file.name || "reference.mp4",
      contentType
    );
    await uploadToR2(upload_url, file, contentType);
    return { objectKey: public_url, mediaType: "video" };
  }

  const publicUrl = await uploadAiResourceImage(file);
  return { objectKey: publicUrl, mediaType: "image" };
}

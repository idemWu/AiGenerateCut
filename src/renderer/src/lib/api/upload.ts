import apiClient from "./client";
import type { components } from "./schema";

type UploadPurpose = components["schemas"]["UploadPurpose"];
type UploadUrlResponse = components["schemas"]["UploadUrlResponse"];
type BaseResponseUploadUrl = components["schemas"]["BaseResponse_UploadUrlResponse_"];
type MultipartInitRequest = components["schemas"]["MultipartInitRequest"];
type MultipartInitResponse = components["schemas"]["MultipartInitResponse"];
type MultipartCompleteRequest = components["schemas"]["MultipartCompleteRequest"];
type MultipartCompleteResponse = components["schemas"]["MultipartCompleteResponse"];
type BaseResponseMultipartInit = components["schemas"]["BaseResponse_MultipartInitResponse_"];
type BaseResponseMultipartComplete = components["schemas"]["BaseResponse_MultipartCompleteResponse_"];

export type { UploadPurpose, UploadUrlResponse };

const MIME_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

function buildSafeUploadFilename(file: File, fallback = "jpg"): string {
  const extFromMime = MIME_EXT_MAP[file.type];
  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const ext = extFromMime || (extFromName && /^[a-z0-9]+$/.test(extFromName) ? extFromName : fallback);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `ai-resource-${Date.now()}-${suffix}.${ext}`;
}

/**
 * 获取 R2 直传预签名 URL
 */
export async function getUploadUrl(
  purpose: UploadPurpose,
  filename: string,
  content_type?: string | null
): Promise<UploadUrlResponse> {
  const { data } = await apiClient.post<BaseResponseUploadUrl>(
    "/api/v1/files/upload-url",
    { purpose, filename, content_type: content_type ?? null }
  );
  if (data.code !== 0 || !data.data) {
    const code = typeof data.code === "number" ? data.code : 0;
    const msg = data.msg || "Failed to get upload URL";
    const err = new Error(msg) as Error & { code?: number };
    err.code = code;
    throw err;
  }
  return data.data;
}

/**
 * 直传文件到 R2（使用预签名 PUT URL，不经过 axios）
 */
export async function uploadToR2(
  uploadUrl: string,
  blob: Blob,
  contentType?: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: {
      "Content-Type": contentType || blob.type || "application/octet-stream",
    },
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
}

/**
 * 上传图片到 R2（带进度回调）
 */
export async function uploadImageWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const contentType = file.type || "image/jpeg";
  const filename = file.name || "image.jpg";
  const { upload_url, public_url } = await getUploadUrl(
    "video_cover",
    filename,
    contentType
  );
  await putWithProgress(upload_url, file, contentType, onProgress);
  return public_url;
}

/**
 * 上传 Studio / AI 资源类图片到 R2，返回公网 URL（画布图片节点等）。
 */
export async function uploadAiResourceImage(file: File): Promise<string> {
  const contentType = file.type || "image/jpeg";
  const filename = buildSafeUploadFilename(file, "jpg");
  const { upload_url, public_url } = await getUploadUrl(
    "ai_resource_image",
    filename,
    contentType
  );
  await uploadToR2(upload_url, file, contentType);
  return public_url;
}

const VIDEO_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 初始化分片上传（大文件用）
 */
export async function initMultipartUpload(
  body: MultipartInitRequest
): Promise<MultipartInitResponse> {
  const { data } = await apiClient.post<BaseResponseMultipartInit>(
    "/api/v1/files/multipart/init",
    body
  );
  if (data.code !== 0 || !data.data) {
    const code = typeof data.code === "number" ? data.code : 0;
    const msg = data.msg || "Failed to init multipart upload";
    const err = new Error(msg) as Error & { code?: number };
    err.code = code;
    throw err;
  }
  return data.data;
}

/**
 * 完成分片上传
 */
export async function completeMultipartUpload(
  body: MultipartCompleteRequest
): Promise<MultipartCompleteResponse> {
  const { data } = await apiClient.post<BaseResponseMultipartComplete>(
    "/api/v1/files/multipart/complete",
    body
  );
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || "Failed to complete multipart upload");
  }
  return data.data;
}

/**
 * 上传视频文件到 R2，返回公网 URL。
 * 小文件（<5MB）用单次 PUT，大文件用分片上传。
 * @param onProgress 可选，0–100 进度回调（分片时按 part 更新，单次 PUT 时用 XHR 报告）
 */
export async function uploadVideoFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const contentType = file.type || "video/mp4";
  const filename = file.name || "video.mp4";

  if (file.size < VIDEO_CHUNK_SIZE) {
    const { upload_url, public_url } = await getUploadUrl(
      "video",
      filename,
      contentType
    );
    await putWithProgress(upload_url, file, contentType, onProgress);
    return public_url;
  }

  const partCount = Math.ceil(file.size / VIDEO_CHUNK_SIZE);
  onProgress?.(0);
  const initRes = await initMultipartUpload({
    purpose: "video",
    filename,
    part_count: partCount,
    content_type: contentType,
  });

  const parts: { part_number: number; etag: string }[] = [];
  for (let i = 0; i < partCount; i++) {
    const partNumber = i + 1;
    const partInfo = initRes.parts.find((p) => p.part_number === partNumber);
    if (!partInfo) {
      throw new Error(`Missing part URL for part ${partNumber}`);
    }
    const start = i * VIDEO_CHUNK_SIZE;
    const end = Math.min(start + VIDEO_CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    const res = await fetch(partInfo.upload_url, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": contentType,
      },
    });
    if (!res.ok) {
      throw new Error(`Part ${partNumber} upload failed: ${res.status}`);
    }
    const etag = res.headers.get("ETag")?.trim() ?? "";
    if (!etag) {
      throw new Error(`Part ${partNumber} missing ETag`);
    }
    parts.push({ part_number: partNumber, etag });
    onProgress?.(Math.round((100 * (i + 1)) / partCount));
  }

  const completeRes = await completeMultipartUpload({
    upload_id: initRes.upload_id,
    object_key: initRes.object_key,
    parts,
  });
  return completeRes.public_url;
}

/**
 * 使用 XMLHttpRequest 上传以便上报进度
 */
function putWithProgress(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.send(blob);
  });
}

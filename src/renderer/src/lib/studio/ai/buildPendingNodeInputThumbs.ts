import type {
  StudioAiReference,
  StudioWorkflowNodeInputRole,
} from "@/lib/studio/studioAiResources";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";

export interface PendingNodeInputThumb {
  inputRole: StudioWorkflowNodeInputRole;
  sortOrder: number;
  mediaType: "image" | "video";
  thumbUrl: string;
}

function referenceThumbUrl(ref: StudioAiReference): string | null {
  if (ref.thumbUrl) {
    return resolveStudioMediaUrl(ref.thumbUrl) ?? ref.thumbUrl;
  }
  if (ref.source.kind === "upload") {
    return resolveStudioMediaUrl(ref.source.objectKey) ?? ref.source.objectKey;
  }
  if (ref.source.kind === "node_output") {
    return ref.thumbUrl ? resolveStudioMediaUrl(ref.thumbUrl) : null;
  }
  return null;
}

function referenceMediaType(ref: StudioAiReference): "image" | "video" {
  if (ref.source.kind === "upload" || ref.source.kind === "node_output") {
    return ref.source.mediaType;
  }
  return "image";
}

/** 发送生成前，从 Composer references 构建历史气泡用的临时缩略图 */
export function buildPendingNodeInputThumbs(
  references: StudioAiReference[]
): PendingNodeInputThumb[] {
  const thumbs: PendingNodeInputThumb[] = [];
  for (const ref of references) {
    const thumbUrl = referenceThumbUrl(ref);
    if (!thumbUrl) continue;
    thumbs.push({
      inputRole: ref.inputRole,
      sortOrder: ref.sortOrder,
      mediaType: referenceMediaType(ref),
      thumbUrl,
    });
  }
  return thumbs;
}

import type { StudioWorkflowNodeResponse } from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import type { PendingNodeInputThumb } from "./buildPendingNodeInputThumbs";

type StudioWorkflowNodeInputResponse =
  components["schemas"]["StudioWorkflowNodeInputResponse"];

export interface ResolveNodeInputThumbUrlOptions {
  keyframesById?: Map<number, string | null | undefined>;
  pendingThumbs?: PendingNodeInputThumb[];
}

function matchPendingThumb(
  input: StudioWorkflowNodeInputResponse,
  pending: PendingNodeInputThumb[]
): PendingNodeInputThumb | undefined {
  return pending.find(
    (p) => p.inputRole === input.input_role && p.sortOrder === input.sort_order
  );
}

export function resolveNodeInputThumbUrl(
  input: StudioWorkflowNodeInputResponse,
  node: StudioWorkflowNodeResponse,
  options?: ResolveNodeInputThumbUrlOptions
): string | null {
  const fromApi = resolveStudioMediaUrl(input.object_url);
  if (fromApi) return fromApi;

  if (input.source_output_id != null) {
    const output = node.outputs?.find((o) => o.id === input.source_output_id);
    const fromOutput = resolveStudioMediaUrl(output?.object_url);
    if (fromOutput) return fromOutput;
  }

  if (input.keyframe_id != null && options?.keyframesById) {
    const fromKeyframe = resolveStudioMediaUrl(
      options.keyframesById.get(input.keyframe_id)
    );
    if (fromKeyframe) return fromKeyframe;
  }

  const pending = options?.pendingThumbs
    ? matchPendingThumb(input, options.pendingThumbs)
    : undefined;
  if (pending?.thumbUrl) return pending.thumbUrl;

  return null;
}

export function resolveNodeInputMediaType(
  input: StudioWorkflowNodeInputResponse,
  options?: ResolveNodeInputThumbUrlOptions
): "image" | "video" {
  if (input.media_type === "video") return "video";
  const pending = options?.pendingThumbs
    ? matchPendingThumb(input, options.pendingThumbs)
    : undefined;
  if (pending) return pending.mediaType;
  return "image";
}

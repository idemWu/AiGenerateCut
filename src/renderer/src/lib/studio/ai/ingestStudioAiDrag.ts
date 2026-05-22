import type { StudioAiDragPayload } from "@/lib/studio/ai/studioAiDrag";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import {
  appendExtraVideoReference,
  getReferenceForSlot,
  getVideoSlotsForMode,
  referenceFromSource,
  type StudioAiReference,
  type StudioAiReferenceSource,
  type StudioVideoExtraKind,
  type StudioVideoMode,
  type StudioVideoSlotDef,
  upsertReferenceForSlot,
} from "@/lib/studio/studioAiResources";

export type IngestDragErrorKey = "studioAiDropWrongType";

export type IngestDragResult =
  | { success: true }
  | { success: false; errorKey: IngestDragErrorKey };

export interface IngestDragPayloadToReferencesParams {
  payload: StudioAiDragPayload | null;
  operationType: StudioAiOperationType;
  videoMode: StudioVideoMode;
  references: StudioAiReference[];
  onReferencesChange: (refs: StudioAiReference[]) => void;
  targetSlotId?: string;
}

function payloadMediaType(source: StudioAiReferenceSource): "image" | "video" {
  if (source.kind === "node_output") return source.mediaType;
  if (source.kind === "upload") return source.mediaType;
  return "image";
}

function parseExtraKind(targetSlotId: string): StudioVideoExtraKind | null {
  if (targetSlotId === "extra_refer") return "refer_image";
  if (targetSlotId === "extra_feature") return "feature_video";
  if (targetSlotId === "extra_base") return "base_video";
  return null;
}

function findTargetVideoSlot(
  slots: StudioVideoSlotDef[],
  references: StudioAiReference[],
  targetSlotId?: string
): StudioVideoSlotDef | undefined {
  if (targetSlotId) {
    return slots.find((s) => s.slotId === targetSlotId);
  }

  const emptyRequired = slots.find(
    (s) => !s.optional && !getReferenceForSlot(references, s)
  );
  if (emptyRequired) return emptyRequired;

  return slots.find((s) => s.optional && !getReferenceForSlot(references, s));
}

function ingestExtraReference(
  params: IngestDragPayloadToReferencesParams,
  kind: StudioVideoExtraKind,
  mediaType: "image" | "video"
): IngestDragResult {
  const { payload, references, onReferencesChange } = params;
  if (!payload) {
    return { success: false, errorKey: "studioAiDropWrongType" };
  }

  if (kind === "refer_image" && mediaType !== "image") {
    return { success: false, errorKey: "studioAiDropWrongType" };
  }
  if ((kind === "feature_video" || kind === "base_video") && mediaType !== "video") {
    return { success: false, errorKey: "studioAiDropWrongType" };
  }

  const inputParams =
    kind === "feature_video" || kind === "base_video"
      ? { keep_original_sound: false }
      : undefined;

  const next = referenceFromSource({
    source: payload.source,
    label: payload.label,
    thumbUrl: payload.thumbUrl,
    inputRole: kind === "refer_image" ? "refer" : kind === "feature_video" ? "feature" : "base",
    sortOrder: 0,
    inputParams,
  });

  onReferencesChange(appendExtraVideoReference(references, kind, next));
  return { success: true };
}

function resolveExtraKindForDrop(
  mediaType: "image" | "video",
  targetSlotId?: string
): StudioVideoExtraKind | null {
  const parsed = targetSlotId ? parseExtraKind(targetSlotId) : null;
  if (parsed) return parsed;
  if (mediaType === "image") return "refer_image";
  return "feature_video";
}

export function ingestDragPayloadToReferences(
  params: IngestDragPayloadToReferencesParams
): IngestDragResult {
  const {
    payload,
    operationType,
    videoMode,
    references,
    onReferencesChange,
    targetSlotId,
  } = params;

  if (!payload) {
    return { success: false, errorKey: "studioAiDropWrongType" };
  }

  const mediaType = payloadMediaType(payload.source);

  if (operationType !== "video") {
    if (mediaType !== "image") {
      return { success: false, errorKey: "studioAiDropWrongType" };
    }
    const next = referenceFromSource({
      source: payload.source,
      label: payload.label,
      thumbUrl: payload.thumbUrl,
      inputRole: "image",
      sortOrder: references.filter((r) => r.inputRole === "image").length,
    });
    onReferencesChange(
      upsertReferenceForSlot(references, next, { operationType, videoMode })
    );
    return { success: true };
  }

  const extraKindFromTarget = targetSlotId ? parseExtraKind(targetSlotId) : null;
  if (extraKindFromTarget) {
    return ingestExtraReference(params, extraKindFromTarget, mediaType);
  }

  const slots = getVideoSlotsForMode(videoMode);

  if (slots.length === 0) {
    const kind = resolveExtraKindForDrop(mediaType, targetSlotId);
    if (!kind) {
      return { success: false, errorKey: "studioAiDropWrongType" };
    }
    return ingestExtraReference(params, kind, mediaType);
  }

  const slot = findTargetVideoSlot(slots, references, targetSlotId);
  if (!slot) {
    const kind = resolveExtraKindForDrop(mediaType, targetSlotId);
    if (kind && mediaType === (kind === "refer_image" ? "image" : "video")) {
      return ingestExtraReference(params, kind, mediaType);
    }
    return { success: false, errorKey: "studioAiDropWrongType" };
  }

  if (mediaType !== slot.mediaType) {
    return { success: false, errorKey: "studioAiDropWrongType" };
  }

  const next = referenceFromSource({
    source: payload.source,
    label: payload.label,
    thumbUrl: payload.thumbUrl,
    inputRole: slot.inputRole,
    sortOrder: 0,
    inputParams: slot.allowKeepSound ? { keep_original_sound: false } : undefined,
  });

  onReferencesChange(
    upsertReferenceForSlot(references, next, {
      operationType,
      videoMode,
      slotId: slot.slotId,
    })
  );
  return { success: true };
}

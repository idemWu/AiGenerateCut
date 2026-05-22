import type { components } from "@/lib/api/schema";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";

type StudioAiGenerationInputRequest =
  components["schemas"]["StudioAiGenerationInputRequest"];
type StudioWorkflowNodeInputRole =
  components["schemas"]["StudioWorkflowNodeInputRole"];
type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];
type StudioImageSize = components["schemas"]["StudioImageSize"];

export type { StudioAiOperationType };

export type StudioAiReferenceSource =
  | { kind: "keyframe"; id: number }
  | { kind: "asset"; id: number }
  | { kind: "node_output"; outputId: number; mediaType: "image" | "video" }
  | { kind: "upload"; objectKey: string; mediaType: "image" | "video" };

export interface StudioAiReference {
  id: string;
  source: StudioAiReferenceSource;
  label: string;
  thumbUrl?: string | null;
  inputRole: StudioWorkflowNodeInputRole;
  sortOrder: number;
  inputParams?: { keep_original_sound?: boolean };
}

export type StudioVideoMode = "text2video" | "first_frame" | "first_last_frame";

export type StudioVideoExtraKind = "refer_image" | "feature_video" | "base_video";

export const CORE_VIDEO_ROLES = ["first_frame", "last_frame"] as const;
export const EXTRA_VIDEO_ROLES = ["refer", "feature", "base"] as const;

export interface StudioVideoSlotDef {
  slotId: string;
  inputRole: StudioWorkflowNodeInputRole;
  mediaType: "image" | "video";
  optional?: boolean;
  allowKeepSound?: boolean;
}

const VIDEO_ASPECT_RATIOS: StudioAspectRatio[] = ["1:1", "16:9", "9:16"];

export function createStudioAiReferenceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getVideoSlotsForMode(mode: StudioVideoMode): StudioVideoSlotDef[] {
  switch (mode) {
    case "text2video":
      return [];
    case "first_frame":
      return [
        { slotId: "first_frame", inputRole: "first_frame", mediaType: "image" },
      ];
    case "first_last_frame":
      return [
        { slotId: "first_frame", inputRole: "first_frame", mediaType: "image" },
        { slotId: "last_frame", inputRole: "last_frame", mediaType: "image" },
      ];
  }
}

export function isCoreVideoRole(
  role: StudioWorkflowNodeInputRole
): role is (typeof CORE_VIDEO_ROLES)[number] {
  return (CORE_VIDEO_ROLES as readonly string[]).includes(role);
}

export function isExtraVideoRole(
  role: StudioWorkflowNodeInputRole
): role is (typeof EXTRA_VIDEO_ROLES)[number] {
  return (EXTRA_VIDEO_ROLES as readonly string[]).includes(role);
}

export function clearCoreVideoReferences(refs: StudioAiReference[]): StudioAiReference[] {
  return refs.filter((r) => !isCoreVideoRole(r.inputRole));
}

export function getExtraVideoReferences(refs: StudioAiReference[]): StudioAiReference[] {
  return refs.filter((r) => isExtraVideoRole(r.inputRole));
}

export function getReferImageReferences(refs: StudioAiReference[]): StudioAiReference[] {
  return refs.filter((r) => r.inputRole === "refer");
}

export function getFeatureVideoReference(
  refs: StudioAiReference[]
): StudioAiReference | undefined {
  return refs.find((r) => r.inputRole === "feature");
}

export function getBaseVideoReference(refs: StudioAiReference[]): StudioAiReference | undefined {
  return refs.find((r) => r.inputRole === "base");
}

export function extraKindToInputRole(
  kind: StudioVideoExtraKind
): StudioWorkflowNodeInputRole {
  switch (kind) {
    case "refer_image":
      return "refer";
    case "feature_video":
      return "feature";
    case "base_video":
      return "base";
  }
}

export function appendExtraVideoReference(
  refs: StudioAiReference[],
  kind: StudioVideoExtraKind,
  payload: Omit<StudioAiReference, "id">
): StudioAiReference[] {
  const role = extraKindToInputRole(kind);
  const next: StudioAiReference = {
    ...payload,
    id: createStudioAiReferenceId(),
    inputRole: role,
  };

  if (kind === "refer_image") {
    const referRefs = refs.filter((r) => r.inputRole === "refer");
    return [
      ...refs.filter((r) => r.inputRole !== "refer"),
      { ...next, sortOrder: referRefs.length },
    ];
  }

  return [...refs.filter((r) => r.inputRole !== role), { ...next, sortOrder: 0 }];
}

export function slotAcceptsMedia(
  slot: StudioVideoSlotDef,
  mediaType: "image" | "video"
): boolean {
  return slot.mediaType === mediaType;
}

export function filterVideoAspectRatio(
  projectRatio: StudioAspectRatio | null | undefined,
  supported?: StudioAspectRatio[] | null
): StudioAspectRatio {
  const pool =
    supported && supported.length > 0
      ? supported.filter((r) => VIDEO_ASPECT_RATIOS.includes(r))
      : VIDEO_ASPECT_RATIOS;
  const allowed = pool.length > 0 ? pool : VIDEO_ASPECT_RATIOS;
  if (projectRatio && allowed.includes(projectRatio)) {
    return projectRatio;
  }
  if (allowed.includes("16:9")) return "16:9";
  return allowed[0]!;
}

export function referencesHaveVideoInput(refs: StudioAiReference[]): boolean {
  return refs.some(
    (r) =>
      r.inputRole === "base" ||
      r.inputRole === "feature" ||
      (r.source.kind === "upload" && r.source.mediaType === "video") ||
      (r.source.kind === "node_output" && r.source.mediaType === "video")
  );
}

export function clampVideoDuration(
  duration: number,
  hasVideoInput: boolean,
  supported?: number[] | null
): number {
  const min = 3;
  const max = hasVideoInput ? 10 : 15;
  let value = Math.round(duration);
  value = Math.min(max, Math.max(min, value));
  if (supported?.length) {
    const sorted = [...supported].sort((a, b) => a - b);
    const nearest = sorted.reduce((prev, cur) =>
      Math.abs(cur - value) < Math.abs(prev - value) ? cur : prev
    );
    if (nearest >= min && nearest <= max) {
      value = nearest;
    }
  }
  return value;
}

export function buildGenerationInputs(
  refs: StudioAiReference[]
): StudioAiGenerationInputRequest[] {
  const sorted = [...refs].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((ref, index) => {
    const mediaType =
      ref.inputRole === "base" || ref.inputRole === "feature"
        ? "video"
        : ref.source.kind === "upload"
          ? ref.source.mediaType
          : ref.source.kind === "node_output"
            ? ref.source.mediaType
            : "image";

    const base: StudioAiGenerationInputRequest = {
      source_type: mapSourceType(ref.source),
      input_role: ref.inputRole,
      media_type: mediaType,
      sort_order: index,
    };

    if (ref.inputParams && (ref.inputRole === "base" || ref.inputRole === "feature")) {
      base.params = { keep_original_sound: ref.inputParams.keep_original_sound ?? false };
    }

    if (ref.source.kind === "keyframe") {
      return { ...base, keyframe_id: ref.source.id };
    }
    if (ref.source.kind === "asset") {
      return { ...base, asset_id: ref.source.id };
    }
    if (ref.source.kind === "node_output") {
      return { ...base, source_output_id: ref.source.outputId };
    }
    return { ...base, object_key: ref.source.objectKey };
  });
}

function mapSourceType(
  source: StudioAiReferenceSource
): StudioAiGenerationInputRequest["source_type"] {
  if (source.kind === "keyframe") return "keyframe";
  if (source.kind === "asset") return "asset";
  if (source.kind === "node_output") return "node_output";
  return "upload";
}

export interface ValidateGenerationOptions {
  operationType: StudioAiOperationType;
  videoMode: StudioVideoMode;
  prompt: string;
  modelId: string;
  references: StudioAiReference[];
}

export type StudioAiValidationErrorKey =
  | "studioAiSelectModel"
  | "studioPromptRequired"
  | "studioAiSlotRequired";

export interface ValidateGenerationResult {
  ok: boolean;
  errorKey?: StudioAiValidationErrorKey;
}

export function validateGenerationRequest(
  options: ValidateGenerationOptions
): ValidateGenerationResult {
  const { operationType, videoMode, prompt, modelId, references } = options;

  if (!modelId.trim()) {
    return { ok: false, errorKey: "studioAiSelectModel" };
  }

  if (!prompt.trim()) {
    return { ok: false, errorKey: "studioPromptRequired" };
  }

  if (operationType === "video") {
    const slots = getVideoSlotsForMode(videoMode);
    for (const slot of slots) {
      if (slot.optional) continue;
      const filled = references.some((r) => r.inputRole === slot.inputRole);
      if (!filled) {
        return { ok: false, errorKey: "studioAiSlotRequired" };
      }
    }
  }

  return { ok: true };
}

export function referenceFromSource(params: {
  source: StudioAiReferenceSource;
  label: string;
  thumbUrl?: string | null;
  inputRole: StudioWorkflowNodeInputRole;
  sortOrder: number;
  inputParams?: StudioAiReference["inputParams"];
}): StudioAiReference {
  return {
    id: createStudioAiReferenceId(),
    source: params.source,
    label: params.label,
    thumbUrl: params.thumbUrl,
    inputRole: params.inputRole,
    sortOrder: params.sortOrder,
    inputParams: params.inputParams,
  };
}

export function upsertReferenceForSlot(
  refs: StudioAiReference[],
  next: StudioAiReference,
  options: {
    operationType: StudioAiOperationType;
    videoMode: StudioVideoMode;
    slotId?: string;
  }
): StudioAiReference[] {
  const { operationType, videoMode, slotId } = options;

  if (operationType === "video" && slotId) {
    const slots = getVideoSlotsForMode(videoMode);
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return refs;

    return [
      ...refs.filter((r) => r.inputRole !== slot.inputRole),
      { ...next, inputRole: slot.inputRole, sortOrder: 0 },
    ];
  }

  const imageRefs = refs.filter((r) => r.inputRole === "image");
  return [
    ...refs,
    { ...next, inputRole: "image", sortOrder: imageRefs.length },
  ];
}

export function removeReference(refs: StudioAiReference[], id: string): StudioAiReference[] {
  return refs.filter((r) => r.id !== id);
}

export function getReferenceForSlot(
  refs: StudioAiReference[],
  slot: StudioVideoSlotDef
): StudioAiReference | undefined {
  if (slot.inputRole === "refer" && slot.optional) {
    return refs.find((r) => r.inputRole === "refer");
  }
  return refs.find((r) => r.inputRole === slot.inputRole);
}

export type { StudioAspectRatio, StudioImageSize, StudioWorkflowNodeInputRole };

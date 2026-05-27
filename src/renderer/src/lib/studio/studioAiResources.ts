import type {
  StudioAiGenerationInputRequest,
  StudioAiOperationType,
  StudioAspectRatio,
  StudioImageSize,
  StudioWorkflowNodeInputRole,
} from "@/lib/api/studio";

export type { StudioAiOperationType };

export type StudioAiReferenceSource =
  | { kind: "keyframe"; id: number; resourceId?: number | null }
  | {
      kind: "asset";
      id: number;
      resourceId?: number | null;
      currentVersionId?: number | null;
    }
  | { kind: "node_output"; outputId: number; mediaType: "image" | "video" }
  | {
      kind: "upload";
      objectKey: string;
      mediaType: "image" | "video";
      resourceId?: number | null;
    };

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
export type StudioVideoProviderQuality = "480p" | "720p" | "1080p" | "std" | "pro";

export type StudioVideoExtraKind = "refer_image" | "feature_video" | "base_video";

export const CORE_VIDEO_ROLES = ["first_frame", "last_frame", "image"] as const;
export const EXTRA_VIDEO_ROLES = ["refer", "feature", "base"] as const;

export interface StudioVideoSlotDef {
  slotId: string;
  inputRole: StudioWorkflowNodeInputRole;
  mediaType: "image" | "video";
  optional?: boolean;
  allowKeepSound?: boolean;
  multiple?: boolean;
  maxCount?: number;
}

const DEFAULT_VIDEO_ASPECT_RATIOS: StudioAspectRatio[] = ["1:1", "16:9", "9:16"];
const VIDEO_ASPECT_RATIOS: StudioAspectRatio[] = [...DEFAULT_VIDEO_ASPECT_RATIOS, "adaptive"];
const KLING_V3_VIDEO_GENERATION_MODEL_IDS = new Set([
  "kling-v3-video-generation",
  "keling-v3-video-generation",
  "kling-v3-omni-video-generation",
  "keling-v3-omni-video-generation",
]);
const KELING_V3_OMNI_VIDEO_GENERATION_MODEL_IDS = new Set([
  "kling-v3-omni-video-generation",
  "keling-v3-omni-video-generation",
]);
const SEEDANCE_VIDEO_GENERATION_MODEL_IDS = new Set(["seedance", "seedance-fast"]);

export function createStudioAiReferenceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isKelingV3OmniVideoGenerationModel(
  modelId: string | null | undefined
): boolean {
  return modelIdMatches(modelId, KELING_V3_OMNI_VIDEO_GENERATION_MODEL_IDS);
}

export function isKlingV3VideoGenerationModel(modelId: string | null | undefined): boolean {
  return modelIdMatches(modelId, KLING_V3_VIDEO_GENERATION_MODEL_IDS);
}

export function isSeedanceVideoGenerationModel(modelId: string | null | undefined): boolean {
  return modelIdMatches(modelId, SEEDANCE_VIDEO_GENERATION_MODEL_IDS);
}

export function isSeedanceFastVideoGenerationModel(
  modelId: string | null | undefined
): boolean {
  return modelIdMatches(modelId, new Set(["seedance-fast"]));
}

function modelIdMatches(modelId: string | null | undefined, candidates: ReadonlySet<string>): boolean {
  const normalized = modelId?.trim().toLowerCase();
  if (!normalized) return false;
  for (const id of candidates) {
    if (normalized === id || normalized.endsWith(`/${id}`)) return true;
  }
  return false;
}

export function usesMultiImageVideoReferences(
  mode: StudioVideoMode,
  modelId: string | null | undefined
): boolean {
  return mode === "first_frame" && isKelingV3OmniVideoGenerationModel(modelId);
}

export function getVideoSlotsForMode(
  mode: StudioVideoMode,
  modelId?: string | null
): StudioVideoSlotDef[] {
  if (usesMultiImageVideoReferences(mode, modelId)) {
    return [
      {
        slotId: "refer",
        inputRole: "image",
        mediaType: "image",
        multiple: true,
        maxCount: 7,
      },
    ];
  }

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
        { slotId: "last_frame", inputRole: "last_frame", mediaType: "image", optional: true },
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
      : DEFAULT_VIDEO_ASPECT_RATIOS;
  const allowed = pool.length > 0 ? pool : DEFAULT_VIDEO_ASPECT_RATIOS;
  if (projectRatio && allowed.includes(projectRatio)) {
    return projectRatio;
  }
  if (allowed.includes("16:9")) return "16:9";
  return allowed[0]!;
}

export function getVideoProviderQualityOptions(
  modelId: string | null | undefined
): { value: StudioVideoProviderQuality; label: string }[] {
  if (isKlingV3VideoGenerationModel(modelId)) {
    return [
      { value: "std", label: "720P" },
      { value: "pro", label: "1080P" },
    ];
  }
  if (isSeedanceFastVideoGenerationModel(modelId)) {
    return [
      { value: "480p", label: "480P" },
      { value: "720p", label: "720P" },
    ];
  }
  if (isSeedanceVideoGenerationModel(modelId)) {
    return [
      { value: "480p", label: "480P" },
      { value: "720p", label: "720P" },
      { value: "1080p", label: "1080P" },
    ];
  }
  return [
    { value: "720p", label: "720P" },
    { value: "1080p", label: "1080P" },
  ];
}

export function clampVideoProviderQuality(
  modelId: string | null | undefined,
  quality: StudioVideoProviderQuality
): StudioVideoProviderQuality {
  const options = getVideoProviderQualityOptions(modelId);
  if (options.some((option) => option.value === quality)) return quality;

  if (isKlingV3VideoGenerationModel(modelId)) {
    return quality === "1080p" ? "pro" : "std";
  }
  if (isSeedanceVideoGenerationModel(modelId)) {
    if (quality === "pro") return isSeedanceFastVideoGenerationModel(modelId) ? "720p" : "1080p";
    return "720p";
  }
  return options[0]?.value ?? "720p";
}

export function buildVideoProviderParams(
  modelId: string | null | undefined,
  quality: StudioVideoProviderQuality
): Record<string, unknown> | undefined {
  const normalizedQuality = clampVideoProviderQuality(modelId, quality);
  if (isKlingV3VideoGenerationModel(modelId)) {
    const mode = normalizedQuality === "std" ? "std" : "pro";
    return {
      providers: {
        kling: {
          parameters: { mode },
        },
      },
    };
  }
  if (isSeedanceVideoGenerationModel(modelId)) {
    const resolution =
      normalizedQuality === "480p" || normalizedQuality === "1080p"
        ? normalizedQuality
        : "720p";
    return {
      providers: {
        seedance: { resolution },
      },
    };
  }
  return undefined;
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
  supported?: number[] | null,
  modelId?: string | null
): number {
  const min = isSeedanceVideoGenerationModel(modelId) ? 4 : 3;
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
      return ref.source.resourceId
        ? { ...base, resource_id: ref.source.resourceId }
        : { ...base, keyframe_id: ref.source.id };
    }
    if (ref.source.kind === "asset") {
      return ref.source.resourceId
        ? { ...base, resource_id: ref.source.resourceId }
        : {
            ...base,
            asset_id: ref.source.id,
            asset_version_id: ref.source.currentVersionId,
          };
    }
    if (ref.source.kind === "node_output") {
      return { ...base, source_output_id: ref.source.outputId };
    }
    return ref.source.resourceId
      ? { ...base, resource_id: ref.source.resourceId }
      : { ...base, object_key: ref.source.objectKey };
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
    const slots = getVideoSlotsForMode(videoMode, modelId);
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
    modelId?: string | null;
    slotId?: string;
  }
): StudioAiReference[] {
  const { operationType, videoMode, modelId, slotId } = options;

  if (operationType === "video" && slotId) {
    const slots = getVideoSlotsForMode(videoMode, modelId);
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return refs;

    if (slot.multiple) {
      const slotRefs = refs.filter((r) => r.inputRole === slot.inputRole);
      if (slot.maxCount != null && slotRefs.length >= slot.maxCount) {
        return refs;
      }
      return [
        ...refs,
        { ...next, inputRole: slot.inputRole, sortOrder: slotRefs.length },
      ];
    }

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

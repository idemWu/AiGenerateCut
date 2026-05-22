import type { components } from "@/lib/api/schema";

export type StudioAiModelInfo = components["schemas"]["StudioAiModelInfo"];
export type StudioAiModelListResponse = components["schemas"]["StudioAiModelListResponse"];
export type StudioAiOperationType = components["schemas"]["StudioAiOperationType"];

export function flattenStudioModels(
  list: StudioAiModelListResponse | undefined
): StudioAiModelInfo[] {
  if (!list) return [];
  return [
    ...(list.language_models ?? []),
    ...(list.image_models ?? []),
    ...(list.video_models ?? []),
  ];
}

export function findStudioModel(
  models: StudioAiModelInfo[],
  modelId: string
): StudioAiModelInfo | undefined {
  return models.find((m) => m.id === modelId);
}

export function defaultVideoDuration(model: StudioAiModelInfo | undefined): number {
  const durations = model?.supported_durations;
  if (durations?.length) return durations[0]!;
  return 5;
}

export function getModelsForOperationType(
  list: StudioAiModelListResponse | undefined,
  type: StudioAiOperationType
): StudioAiModelInfo[] {
  if (!list) return [];
  if (type === "text") return list.language_models ?? [];
  if (type === "image") return list.image_models ?? [];
  return list.video_models ?? [];
}

const MODEL_PILL_MAX_LEN = 18;

/** Pill 上展示的短标签；下拉仍用完整 name */
export function formatStudioModelPillLabel(model: StudioAiModelInfo): string {
  const full = model.name?.trim() || model.id;
  if (full.length <= MODEL_PILL_MAX_LEN) return full;
  const segment = model.id.split("/").pop() ?? model.id;
  if (segment.length <= MODEL_PILL_MAX_LEN) return segment;
  return `${segment.slice(0, MODEL_PILL_MAX_LEN - 1)}…`;
}

export function formatStudioModelOptionLabel(model: StudioAiModelInfo): string {
  return model.name?.trim() || model.id;
}

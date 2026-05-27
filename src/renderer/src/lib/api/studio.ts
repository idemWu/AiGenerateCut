import apiClient from "./client";

export type { StudioClipTransform } from "@/lib/studio/composition/clipTransform";

export type StudioAspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "21:9"
  | "adaptive";
export type StudioImageSize = "1K" | "2K" | "4K";
export type StudioAiOperationType = "text" | "image" | "video";
export type StudioResourceType = "image" | "video" | "audio" | "text" | "document";
export type StudioClipMediaType = "image" | "video" | "audio" | "text" | "empty";
export type StudioNodeType =
  | "text_generation"
  | "image_generation"
  | "video_generation"
  | "user_input";
export type StudioAssetType = "character" | "scene" | "prop" | "style";

export interface StudioProjectResponse {
  id: number;
  user_id?: number;
  project_type?: "studio" | "script" | "agent" | "tool" | "chat";
  title: string;
  description?: string | null;
  cover_resource_id?: number | null;
  cover_url?: string | null;
  aspect_ratio?: StudioAspectRatio | null;
  settings?: Record<string, unknown> | null;
  created_at: string;
  modified_at: string;
}

export interface StudioClipResponse {
  id: number;
  project_id: number;
  track_id: number;
  session_id?: number | null;
  workflow_id?: number | null;
  session_node_id?: number | null;
  workflow_node_id?: number | null;
  session_node_output_id?: number | null;
  workflow_node_output_id?: number | null;
  resource_id?: number | null;
  title?: string | null;
  clip_type?: StudioClipMediaType;
  media_type: StudioClipMediaType;
  text_content?: string | null;
  media_url?: string | null;
  source_duration_sec?: number | null;
  aspect_ratio?: StudioAspectRatio | string | null;
  status?: "active" | "disabled" | "hidden";
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  media_start_sec?: number | null;
  media_end_sec?: number | null;
  transform?:
    | import("@/lib/studio/composition/clipTransform").StudioClipTransform
    | Record<string, unknown>
    | null;
  created_at?: string;
  modified_at?: string;
}

export interface StudioTimelineTrackResponse {
  id: number;
  project_id: number;
  title?: string | null;
  track_type?: "video" | "audio";
  sort_order: number;
  is_muted?: boolean;
  is_locked?: boolean;
  clips?: StudioClipResponse[];
  created_at?: string;
  modified_at?: string;
}

export interface StudioWorkflowResponse {
  id: number;
  project_id: number;
  session_type?: "studio" | "script" | "chat" | "agent" | "tool";
  title?: string | null;
  description?: string | null;
  node_count?: number;
  clip_count?: number;
  created_at: string;
  modified_at: string;
}

export interface StudioWorkflowNodeInputResponse {
  id?: number;
  input_role: StudioWorkflowNodeInputRole;
  resource_id?: number | null;
  source_output_id?: number | null;
  text_content?: string | null;
  media_type?: StudioResourceType | null;
  object_url?: string | null;
  object_key?: string | null;
  keyframe_id?: number | null;
  asset_id?: number | null;
  sort_order?: number;
  params?: Record<string, unknown> | null;
}

export interface StudioWorkflowNodeOutputResponse {
  id: number;
  project_id?: number;
  node_id?: number;
  resource_id?: number | null;
  output_role?: string | null;
  output_type: StudioResourceType;
  resource_type?: StudioResourceType;
  sort_order?: number;
  object_url?: string | null;
  text_content?: string | null;
  duration_sec?: number | null;
  aspect_ratio?: StudioAspectRatio | string | null;
  params?: Record<string, unknown> | null;
}

export interface StudioWorkflowNodeResponse {
  id: number;
  project_id: number;
  session_id?: number | null;
  workflow_id?: number | null;
  node_type?: StudioNodeType;
  operation_type: StudioAiOperationType;
  status: "pending" | "processing" | "succeeded" | "failed";
  prompt?: string | null;
  model?: string | null;
  generate_count?: number | null;
  image_size?: StudioImageSize | null;
  params?: Record<string, unknown> | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  inputs?: StudioWorkflowNodeInputResponse[];
  outputs?: StudioWorkflowNodeOutputResponse[];
  resource_id?: number | null;
  resource_type?: StudioResourceType | null;
  object_url?: string | null;
  text_content?: string | null;
  duration_sec?: number | null;
  aspect_ratio?: StudioAspectRatio | string | null;
  created_at?: string;
  modified_at?: string;
}

export interface StudioKeyframeResponse {
  id: number;
  project_id: number;
  resource_id?: number | null;
  source_type: "upload" | "generated" | "screenshot";
  usage_type?: "first_frame" | "last_frame" | "reference" | "thumbnail" | null;
  title?: string | null;
  source_session_id?: number | null;
  source_workflow_id?: number | null;
  source_output_id?: number | null;
  source_clip_id?: number | null;
  source_time_sec?: number | null;
  image_url?: string | null;
  created_at?: string;
  modified_at?: string;
}

export interface StudioAssetResponse {
  id: number;
  project_id: number;
  parent_id?: number | null;
  entity_type?: StudioAssetType;
  asset_type: StudioAssetType;
  name?: string | null;
  description?: string | null;
  current_version_id?: number | null;
  current_history_id?: number | null;
  current_image_resource_id?: number | null;
  resource_id?: number | null;
  current_image_url?: string | null;
  image_url?: string | null;
  prompt?: string | null;
  model?: string | null;
  reference_resource_ids?: number[] | null;
  reference_media_urls?: (string | null)[] | null;
  profile?: Record<string, unknown> | null;
  status?: "ready" | "processing" | "failed";
  children_count?: number;
  created_at: string;
  modified_at: string;
}

export interface StudioAssetHistoryResponse {
  id: number;
  project_id: number;
  entity_id?: number;
  asset_id?: number;
  resource_id?: number | null;
  session_node_id?: number | null;
  session_node_output_id?: number | null;
  prompt?: string | null;
  model?: string | null;
  params?: Record<string, unknown> | null;
  reference_resource_ids?: number[] | null;
  reference_media_urls?: (string | null)[] | null;
  version_note?: string | null;
  object_url?: string | null;
  image_url?: string | null;
  image_urls?: string[];
  status: "pending" | "processing" | "ready" | "succeeded" | "failed";
  error_message?: string | null;
  created_at: string;
  modified_at: string;
}

export interface StudioAiModelInfo {
  id: string;
  name: string;
  kind?: StudioAiOperationType;
  operation_type?: StudioAiOperationType;
  supported_aspect_ratios?: StudioAspectRatio[];
  supported_image_sizes?: StudioImageSize[];
  supported_durations?: number[];
}

export interface StudioAiModelListResponse {
  text_models?: StudioAiModelInfo[];
  language_models?: StudioAiModelInfo[];
  image_models?: StudioAiModelInfo[];
  video_models?: StudioAiModelInfo[];
}

export interface CreateStudioProjectRequest {
  title: string;
  description?: string | null;
  project_type?: "studio" | "script" | "agent" | "tool" | "chat";
  cover_url?: string | null;
  aspect_ratio?: StudioAspectRatio | null;
  settings?: Record<string, unknown> | null;
}

export interface CreateStudioWorkflowRequest {
  session_type?: "studio" | "script" | "chat" | "agent" | "tool";
  title?: string | null;
  description?: string | null;
}

export type StudioWorkflowNodeInputRole =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "first_frame"
  | "last_frame"
  | "reference"
  | "refer"
  | "base"
  | "feature";

export interface StudioAiGenerationInputRequest {
  input_role: StudioWorkflowNodeInputRole;
  resource_id?: number | null;
  source_output_id?: number | null;
  text_content?: string | null;
  sort_order?: number;
  params?: Record<string, unknown> | null;
  source_type?: "upload" | "node_output" | "asset" | "keyframe";
  media_type?: StudioResourceType | null;
  object_key?: string | null;
  keyframe_id?: number | null;
  asset_id?: number | null;
  asset_version_id?: number | null;
}

export interface CreateStudioTextGenerationRequest {
  prompt: string;
  model: string;
  inputs?: StudioAiGenerationInputRequest[];
  params?: Record<string, unknown> | null;
}

export interface CreateStudioImageGenerationRequest extends CreateStudioTextGenerationRequest {
  aspect_ratio?: StudioAspectRatio;
  image_size?: StudioImageSize;
  generate_count?: number;
}

export interface CreateStudioVideoGenerationRequest
  extends Omit<CreateStudioTextGenerationRequest, "prompt"> {
  prompt?: string | null;
  model: string;
  inputs?: StudioAiGenerationInputRequest[];
  params?: Record<string, unknown> | null;
  aspect_ratio?: StudioAspectRatio;
  duration_sec: number;
}

type StudioGenerationRequestBody = {
  prompt?: string | null;
  model: string;
  inputs?: StudioAiGenerationInputRequest[];
  params?: Record<string, unknown> | null;
  aspect_ratio?: StudioAspectRatio;
  image_size?: StudioImageSize;
  duration_sec?: number;
};

export interface CreateStudioResourceRequest {
  object_url: string;
  project_id?: number;
  resource_type?: Exclude<StudioResourceType, "text">;
}

export interface StudioResourceResponse {
  id: number;
  user_id?: number;
  project_id?: number | null;
  resource_type: StudioResourceType;
  source_type?: "upload" | "generated" | "screenshot" | "imported" | "manual";
  title?: string | null;
  object_url?: string | null;
  text_content?: string | null;
  mime_type?: string | null;
  duration_sec?: number | null;
  width?: number | null;
  height?: number | null;
  aspect_ratio?: StudioAspectRatio | string | null;
  metadata?: Record<string, unknown> | null;
  status?: "processing" | "ready" | "failed";
  created_at?: string;
  modified_at?: string;
}

export interface CreateStudioClipRequest {
  start_sec: number;
  title?: string | null;
  object_url?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  aspect_ratio?: StudioAspectRatio | string | null;
  session_node_output_id?: number | null;
  workflow_node_output_id?: number | null;
  resource_id?: number | null;
  text_content?: string | null;
  source_type?: "upload" | "node_output" | "resource" | "text" | "empty";
  media_type?: StudioClipMediaType;
  duration_sec?: number;
  source_duration_sec?: number | null;
}

export interface UpdateStudioClipRequest {
  track_id?: number;
  start_sec?: number;
  duration_sec?: number;
  media_start_sec?: number | null;
  media_end_sec?: number | null;
  transform?:
    | import("@/lib/studio/composition/clipTransform").StudioClipTransform
    | Record<string, unknown>
    | null;
  title?: string | null;
  status?: "active" | "disabled" | "hidden";
  text_content?: string | null;
}

export type StudioUpdateClipRequest = UpdateStudioClipRequest;

export interface UpdateStudioClipContentRequest {
  session_node_output_id?: number | null;
  workflow_node_output_id?: number | null;
  resource_id?: number | null;
}

export interface CreateStudioKeyframeRequest {
  source_type: "upload" | "generated" | "screenshot";
  usage_type?: "first_frame" | "last_frame" | "reference" | "thumbnail" | null;
  title?: string | null;
  object_url?: string | null;
  image_url?: string | null;
  source_session_id?: number | null;
  source_workflow_id?: number | null;
  source_output_id?: number | null;
  source_clip_id?: number | null;
  source_time_sec?: number | null;
}

export interface CreateStudioTimelineTrackRequest {
  title?: string | null;
  track_type?: "video" | "audio";
}

export interface CreateStudioAssetRequest {
  parent_id?: number | null;
  entity_type?: StudioAssetType;
  asset_type?: StudioAssetType;
  name?: string | null;
  description?: string | null;
  image_urls?: string[];
  selected_image_url?: string | null;
  prompt?: string | null;
  model?: string | null;
  aspect_ratio?: StudioAspectRatio;
  image_size?: StudioImageSize;
  generate_count?: number;
  reference_resource_ids?: number[];
  reference_media_urls?: string[];
  params?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
}

export interface CreateStudioAssetGenerationRequest {
  prompt: string;
  model: string;
  aspect_ratio?: StudioAspectRatio;
  image_size?: StudioImageSize;
  generate_count?: number;
  reference_resource_ids?: number[];
  reference_media_urls?: string[];
  params?: Record<string, unknown> | null;
}

export interface UpdateStudioAssetRequest {
  name?: string | null;
  description?: string | null;
  entity_type?: StudioAssetType;
  asset_type?: StudioAssetType;
  profile?: Record<string, unknown> | null;
}

export interface SelectStudioAssetImageRequest {
  version_id?: number;
  history_id?: number;
  image_url?: string;
}

export interface PageDataStudioProject extends PageData<StudioProjectResponse> {}

interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data?: T | null;
}

function unwrap<T>(envelope: ApiEnvelope<T>, fallbackMsg: string): T {
  if (envelope.code !== 0 || envelope.data == null) {
    const err = new Error(envelope.msg || fallbackMsg) as Error & { code?: number };
    err.code = envelope.code;
    throw err;
  }
  return envelope.data;
}

function unwrapPageItems<T>(envelope: ApiEnvelope<PageData<T>>, fallbackMsg: string): T[] {
  const page = unwrap(envelope, fallbackMsg);
  return Array.isArray(page.items) ? page.items : [];
}

function nodeTypeToOperationType(nodeType?: string | null): StudioAiOperationType {
  if (nodeType === "text_generation") return "text";
  if (nodeType === "video_generation") return "video";
  return "image";
}

function outputToResourceType(output: Partial<StudioWorkflowNodeOutputResponse>): StudioResourceType {
  return output.resource_type ?? output.output_type ?? "image";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function findStringValue(
  source: unknown,
  keys: readonly string[],
  depth = 0
): string | null {
  if (!isRecord(source) || depth > 3) return null;

  for (const key of keys) {
    const value = normalizeStringValue(source[key]);
    if (value) return value;
  }

  for (const value of Object.values(source)) {
    if (isRecord(value)) {
      const nested = findStringValue(value, keys, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}

function resolveNodeStringMeta(
  node: StudioWorkflowNodeResponse,
  firstOutput: StudioWorkflowNodeOutputResponse | undefined,
  keys: readonly string[]
): string | null {
  for (const source of [node, firstOutput, node.params, firstOutput?.params]) {
    const value = findStringValue(source, keys);
    if (value) return value;
  }
  return null;
}

function inputRoleToCreativeRole(role: StudioWorkflowNodeInputRole): StudioWorkflowNodeInputRole {
  if (role === "refer" || role === "reference") return "image";
  if (role === "base") return "video";
  return role;
}

function normalizeOutput(output: StudioWorkflowNodeOutputResponse): StudioWorkflowNodeOutputResponse {
  const resourceType = outputToResourceType(output);
  return {
    ...output,
    resource_type: resourceType,
    output_type: resourceType,
  };
}

function normalizeNode(node: StudioWorkflowNodeResponse): StudioWorkflowNodeResponse {
  const nodeType = node.node_type;
  const operationType = node.operation_type ?? nodeTypeToOperationType(nodeType);
  const outputs = node.outputs?.map(normalizeOutput);
  const firstOutput = outputs?.[0];
  const aspectRatio = resolveNodeStringMeta(node, firstOutput, [
    "aspect_ratio",
    "aspectRatio",
  ]);
  const imageSize = resolveNodeStringMeta(node, firstOutput, [
    "image_size",
    "imageSize",
    "resolution",
  ]);
  return {
    ...node,
    workflow_id: node.workflow_id ?? node.session_id ?? null,
    operation_type: operationType,
    outputs,
    duration_sec: node.duration_sec ?? firstOutput?.duration_sec ?? null,
    aspect_ratio: aspectRatio,
    image_size: imageSize as StudioImageSize | null,
  };
}

function normalizeClip(clip: StudioClipResponse): StudioClipResponse {
  const mediaType = clip.media_type ?? clip.clip_type ?? "text";
  return {
    ...clip,
    clip_type: clip.clip_type ?? mediaType,
    media_type: mediaType,
    workflow_id: clip.workflow_id ?? clip.session_id ?? null,
    workflow_node_id: clip.workflow_node_id ?? clip.session_node_id ?? null,
    workflow_node_output_id:
      clip.workflow_node_output_id ?? clip.session_node_output_id ?? null,
  };
}

function normalizeTrack(track: StudioTimelineTrackResponse): StudioTimelineTrackResponse {
  return {
    ...track,
    track_type: track.track_type ?? "video",
    clips: track.clips?.map(normalizeClip) ?? [],
  };
}

function normalizeKeyframe(keyframe: StudioKeyframeResponse): StudioKeyframeResponse {
  return {
    ...keyframe,
    image_url: keyframe.image_url ?? (keyframe as { object_url?: string | null }).object_url ?? null,
    source_workflow_id: keyframe.source_workflow_id ?? keyframe.source_session_id ?? null,
  };
}

function normalizeAsset(asset: StudioAssetResponse): StudioAssetResponse {
  const entityType = asset.entity_type ?? asset.asset_type ?? "character";
  return {
    ...asset,
    entity_type: entityType,
    asset_type: entityType,
    current_history_id: asset.current_history_id ?? asset.current_version_id ?? null,
    image_url: asset.image_url ?? asset.current_image_url ?? null,
    resource_id: asset.resource_id ?? asset.current_image_resource_id ?? null,
  };
}

function normalizeAssetHistory(
  history: StudioAssetHistoryResponse
): StudioAssetHistoryResponse {
  const url = history.object_url ?? history.image_url ?? null;
  return {
    ...history,
    asset_id: history.asset_id ?? history.entity_id,
    image_url: url,
    image_urls: history.image_urls ?? (url ? [url] : []),
    status: history.status === "ready" ? "succeeded" : history.status,
  };
}

function normalizeModels(models: StudioAiModelListResponse): StudioAiModelListResponse {
  const textModels = (models.text_models ?? models.language_models ?? []).map((m) => ({
    ...m,
    kind: m.kind ?? "text",
    operation_type: m.operation_type ?? m.kind ?? "text",
  }));
  const imageModels = (models.image_models ?? []).map((m) => ({
    ...m,
    kind: m.kind ?? "image",
    operation_type: m.operation_type ?? m.kind ?? "image",
  }));
  const videoModels = (models.video_models ?? []).map((m) => ({
    ...m,
    kind: m.kind ?? "video",
    operation_type: m.operation_type ?? m.kind ?? "video",
  }));
  return {
    text_models: textModels,
    language_models: textModels,
    image_models: imageModels,
    video_models: videoModels,
  };
}

async function registerResourceUrls(
  projectId: number,
  urls: string[] | undefined
): Promise<number[] | undefined> {
  if (!urls?.length) return undefined;
  const resources = await Promise.all(
    urls.map((object_url) =>
      createStudioResource({ object_url, project_id: projectId, resource_type: "image" })
    )
  );
  return resources.map((resource) => resource.id);
}

async function transformGenerationInput(
  projectId: number,
  input: StudioAiGenerationInputRequest
): Promise<StudioAiGenerationInputRequest> {
  const transformed: StudioAiGenerationInputRequest = {
    input_role: inputRoleToCreativeRole(input.input_role),
    sort_order: input.sort_order,
    params: input.params ?? undefined,
  };
  if (input.text_content != null) {
    transformed.text_content = input.text_content;
  } else if (input.source_output_id != null) {
    transformed.source_output_id = input.source_output_id;
  } else if (input.resource_id != null) {
    transformed.resource_id = input.resource_id;
  } else if (input.keyframe_id != null) {
    throw new Error("Keyframe is missing resource_id");
  } else if (input.asset_id != null) {
    transformed.resource_id = await resolveAssetReferenceResourceId(
      projectId,
      input.asset_id,
      input.asset_version_id
    );
  } else if (input.object_key) {
    const resource = await createStudioResource({
      object_url: input.object_key,
      project_id: projectId,
      resource_type: input.media_type === "video" ? "video" : "image",
    });
    transformed.resource_id = resource.id;
  }
  return transformed;
}

async function resolveAssetReferenceResourceId(
  projectId: number,
  assetId: number,
  versionId?: number | null
): Promise<number> {
  const histories = await listStudioAssetHistories(projectId, assetId, {
    page: 1,
    size: 50,
  });
  const selected =
    versionId != null
      ? histories.find((history) => history.id === versionId)
      : histories.find((history) => history.status === "ready" || history.status === "succeeded");
  const resourceId = selected?.resource_id;
  if (resourceId == null) {
    throw new Error("Entity version is missing resource_id");
  }
  return resourceId;
}

function withGenerationDisplayMeta<T extends StudioGenerationRequestBody>(body: T): T {
  const source = body;
  const displayMeta: Record<string, string | number> = {};

  if (source.aspect_ratio) {
    displayMeta.aspect_ratio = source.aspect_ratio;
  }
  if (source.image_size) {
    displayMeta.image_size = source.image_size;
  }
  if (typeof source.duration_sec === "number") {
    displayMeta.duration_sec = source.duration_sec;
  }

  if (Object.keys(displayMeta).length === 0) return body;

  const params = isRecord(body.params) ? body.params : {};
  const existingDisplayMeta = isRecord(params.display_meta) ? params.display_meta : {};

  return {
    ...body,
    params: {
      ...params,
      display_meta: {
        ...existingDisplayMeta,
        ...displayMeta,
      },
    },
  };
}

function mergeGenerationResponseMeta<T extends StudioGenerationRequestBody>(
  node: StudioWorkflowNodeResponse,
  body: T
): StudioWorkflowNodeResponse {
  const source = body;
  return {
    ...node,
    aspect_ratio: node.aspect_ratio ?? source.aspect_ratio ?? null,
    image_size: node.image_size ?? source.image_size ?? null,
    duration_sec: node.duration_sec ?? source.duration_sec ?? null,
  };
}

async function transformGenerationBody<T extends StudioGenerationRequestBody>(
  projectId: number,
  body: T
): Promise<T> {
  const bodyWithMeta = withGenerationDisplayMeta(body);
  return {
    ...bodyWithMeta,
    inputs: bodyWithMeta.inputs
      ? await Promise.all(
          bodyWithMeta.inputs.map((input) => transformGenerationInput(projectId, input))
        )
      : undefined,
  };
}

function transformCreateClipBody(body: CreateStudioClipRequest): CreateStudioClipRequest {
  const next: CreateStudioClipRequest = {
    start_sec: body.start_sec,
    title: body.title,
  };
  if (body.object_url ?? body.object_key) {
    next.object_url = body.object_url ?? body.object_key ?? undefined;
    next.mime_type =
      body.mime_type ??
      (body.media_type === "video"
        ? "video/mp4"
        : body.media_type === "audio"
          ? "audio/mpeg"
          : "image/png");
    next.width = body.width;
    next.height = body.height;
    next.aspect_ratio = body.aspect_ratio;
  } else if (body.session_node_output_id ?? body.workflow_node_output_id) {
    next.session_node_output_id =
      body.session_node_output_id ?? body.workflow_node_output_id ?? undefined;
  } else if (body.resource_id != null) {
    next.resource_id = body.resource_id;
  } else if (body.text_content != null) {
    next.text_content = body.text_content;
  }
  return next;
}

function transformClipContentBody(
  body: UpdateStudioClipContentRequest
): UpdateStudioClipContentRequest {
  return {
    session_node_output_id:
      body.session_node_output_id ?? body.workflow_node_output_id ?? undefined,
    resource_id: body.resource_id ?? undefined,
  };
}

function transformCreateKeyframeBody(
  body: CreateStudioKeyframeRequest
): CreateStudioKeyframeRequest {
  return {
    ...body,
    object_url: body.object_url ?? body.image_url ?? undefined,
    source_session_id: body.source_session_id ?? body.source_workflow_id ?? undefined,
  };
}

async function transformCreateAssetBody(
  projectId: number,
  body: CreateStudioAssetRequest
): Promise<CreateStudioAssetRequest> {
  const reference_resource_ids =
    body.reference_resource_ids ?? (await registerResourceUrls(projectId, body.reference_media_urls));
  return {
    parent_id: body.parent_id,
    entity_type: body.entity_type ?? body.asset_type,
    name: body.name,
    description: body.description,
    image_urls: body.image_urls,
    selected_image_url: body.selected_image_url,
    prompt: body.prompt,
    model: body.model,
    aspect_ratio: body.aspect_ratio,
    image_size: body.image_size,
    generate_count: body.generate_count,
    reference_resource_ids,
    params: body.params,
    profile: body.profile,
  };
}

async function transformCreateAssetGenerationBody(
  projectId: number,
  body: CreateStudioAssetGenerationRequest
): Promise<CreateStudioAssetGenerationRequest> {
  return {
    ...body,
    reference_resource_ids:
      body.reference_resource_ids ?? (await registerResourceUrls(projectId, body.reference_media_urls)),
    reference_media_urls: undefined,
  };
}

export async function listStudioProjects(params?: {
  page?: number;
  size?: number;
}): Promise<PageDataStudioProject> {
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioProject>>(
    "/api/v1/creative/projects",
    { params }
  );
  return unwrap(data, "Failed to load studio projects");
}

export async function createStudioProject(
  body: CreateStudioProjectRequest
): Promise<StudioProjectResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioProjectResponse>>(
    "/api/v1/creative/projects",
    { project_type: "studio", ...body }
  );
  return unwrap(data, "Failed to create studio project");
}

export async function getStudioProject(projectId: number): Promise<StudioProjectResponse> {
  const { data } = await apiClient.get<ApiEnvelope<StudioProjectResponse>>(
    `/api/v1/creative/projects/${projectId}`
  );
  return unwrap(data, "Failed to load studio project");
}

export async function listStudioTracks(
  projectId: number
): Promise<StudioTimelineTrackResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<StudioTimelineTrackResponse[]>>(
    `/api/v1/studio/projects/${projectId}/tracks`
  );
  return unwrap(data, "Failed to load tracks").map(normalizeTrack);
}

export async function createStudioTrack(
  projectId: number,
  body?: CreateStudioTimelineTrackRequest
): Promise<StudioTimelineTrackResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioTimelineTrackResponse>>(
    `/api/v1/studio/projects/${projectId}/tracks`,
    body ?? {}
  );
  return normalizeTrack(unwrap(data, "Failed to create track"));
}

export async function deleteStudioTrack(
  projectId: number,
  trackId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/studio/projects/${projectId}/tracks/${trackId}`
  );
  if (data.code !== 0) {
    const err = new Error(data.msg || "Failed to delete track") as Error & {
      code?: number;
    };
    err.code = data.code;
    throw err;
  }
}

export async function listStudioWorkflows(
  projectId: number,
  params?: { page?: number; size?: number }
): Promise<StudioWorkflowResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioWorkflowResponse>>>(
    `/api/v1/creative/projects/${projectId}/sessions`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load workflows");
}

export async function createStudioWorkflow(
  projectId: number,
  body: CreateStudioWorkflowRequest
): Promise<StudioWorkflowResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions`,
    { session_type: "studio", ...body }
  );
  return unwrap(data, "Failed to create workflow");
}

export async function listStudioWorkflowNodes(
  projectId: number,
  workflowId: number,
  params?: { page?: number; size?: number }
): Promise<StudioWorkflowNodeResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioWorkflowNodeResponse>>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/nodes`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load workflow nodes").map(normalizeNode);
}

export async function getStudioWorkflowNode(
  projectId: number,
  workflowId: number,
  nodeId: number
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.get<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/nodes/${nodeId}`,
    { timeout: 30_000 }
  );
  return normalizeNode(unwrap(data, "Failed to load workflow node"));
}

export async function retryStudioWorkflowNode(
  projectId: number,
  workflowId: number,
  nodeId: number
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/nodes/${nodeId}/retry`
  );
  return normalizeNode(unwrap(data, "Failed to retry node"));
}

export async function createStudioTextGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioTextGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/text-generations`,
    await transformGenerationBody(projectId, body),
    { timeout: 120_000 }
  );
  return normalizeNode(mergeGenerationResponseMeta(unwrap(data, "Text generation failed"), body));
}

export async function createStudioImageGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioImageGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/image-generations`,
    await transformGenerationBody(projectId, body)
  );
  return normalizeNode(mergeGenerationResponseMeta(unwrap(data, "Image generation failed"), body));
}

export async function createStudioVideoGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioVideoGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/creative/projects/${projectId}/sessions/${workflowId}/video-generations`,
    await transformGenerationBody(projectId, body)
  );
  return normalizeNode(mergeGenerationResponseMeta(unwrap(data, "Video generation failed"), body));
}

export async function createStudioResource(
  body: CreateStudioResourceRequest
): Promise<StudioResourceResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioResourceResponse>>(
    "/api/v1/creative/resources",
    body
  );
  return unwrap(data, "Failed to create resource");
}

export async function createStudioClip(
  projectId: number,
  body: CreateStudioClipRequest
): Promise<StudioClipResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioClipResponse>>(
    `/api/v1/studio/projects/${projectId}/clips`,
    transformCreateClipBody(body)
  );
  return normalizeClip(unwrap(data, "Failed to create clip"));
}

export async function updateStudioClip(
  projectId: number,
  clipId: number,
  body: StudioUpdateClipRequest
): Promise<StudioClipResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioClipResponse>>(
    `/api/v1/studio/projects/${projectId}/clips/${clipId}`,
    body
  );
  return normalizeClip(unwrap(data, "Failed to update clip"));
}

export async function updateStudioClipContent(
  projectId: number,
  clipId: number,
  body: UpdateStudioClipContentRequest
): Promise<StudioClipResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioClipResponse>>(
    `/api/v1/studio/projects/${projectId}/clips/${clipId}/content`,
    transformClipContentBody(body)
  );
  return normalizeClip(unwrap(data, "Failed to update clip content"));
}

export async function deleteStudioClip(
  projectId: number,
  clipId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/studio/projects/${projectId}/clips/${clipId}`
  );
  if (data.code !== 0) {
    const err = new Error(data.msg || "Failed to delete clip") as Error & { code?: number };
    err.code = data.code;
    throw err;
  }
}

export async function listStudioKeyframes(
  projectId: number,
  params?: { page?: number; size?: number }
): Promise<StudioKeyframeResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioKeyframeResponse>>>(
    `/api/v1/studio/projects/${projectId}/keyframes`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load keyframes").map(normalizeKeyframe);
}

export async function createStudioKeyframe(
  projectId: number,
  body: CreateStudioKeyframeRequest
): Promise<StudioKeyframeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioKeyframeResponse>>(
    `/api/v1/studio/projects/${projectId}/keyframes`,
    transformCreateKeyframeBody(body)
  );
  return normalizeKeyframe(unwrap(data, "Failed to create keyframe"));
}

export async function listStudioAssets(
  projectId: number,
  params?: { asset_type?: StudioAssetType; page?: number; size?: number }
): Promise<StudioAssetResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioAssetResponse>>>(
    `/api/v1/creative/projects/${projectId}/entities`,
    { params: { ...params, type: params?.asset_type, asset_type: undefined } }
  );
  return unwrapPageItems(data, "Failed to load assets").map(normalizeAsset);
}

export async function createStudioAsset(
  projectId: number,
  body: CreateStudioAssetRequest
): Promise<StudioAssetResponse> {
  const nextBody = await transformCreateAssetBody(projectId, body);
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/creative/projects/${projectId}/entities`,
    nextBody,
    { timeout: 30_000 }
  );
  return normalizeAsset(unwrap(data, "Failed to create asset"));
}

export async function updateStudioAsset(
  projectId: number,
  assetId: number,
  body: UpdateStudioAssetRequest
): Promise<StudioAssetResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}`,
    {
      ...body,
      entity_type: body.entity_type ?? body.asset_type,
      asset_type: undefined,
    }
  );
  return normalizeAsset(unwrap(data, "Failed to update asset"));
}

export async function deleteStudioAsset(
  projectId: number,
  assetId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}`
  );
  if (data.code !== 0) {
    const err = new Error(data.msg || "Failed to delete asset") as Error & { code?: number };
    err.code = data.code;
    throw err;
  }
}

export async function listStudioAssetHistories(
  projectId: number,
  assetId: number,
  params?: { page?: number; size?: number }
): Promise<StudioAssetHistoryResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioAssetHistoryResponse>>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/versions`,
    { params, timeout: 30_000 }
  );
  return unwrapPageItems(data, "Failed to load asset histories").map(normalizeAssetHistory);
}

export async function createStudioAssetGeneration(
  projectId: number,
  assetId: number,
  body: CreateStudioAssetGenerationRequest
): Promise<StudioAssetHistoryResponse> {
  const nextBody = await transformCreateAssetGenerationBody(projectId, body);
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetHistoryResponse>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/generations`,
    nextBody,
    { timeout: 30_000 }
  );
  return normalizeAssetHistory(unwrap(data, "Asset generation failed"));
}

export async function selectStudioAssetCurrentImage(
  projectId: number,
  assetId: number,
  body: SelectStudioAssetImageRequest
): Promise<StudioAssetResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/current-version`,
    { version_id: body.version_id ?? body.history_id }
  );
  return normalizeAsset(unwrap(data, "Failed to set asset image"));
}

export async function retryStudioAssetGeneration(
  projectId: number,
  assetId: number,
  historyId: number
): Promise<StudioAssetHistoryResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetHistoryResponse>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/generations/${historyId}/retry`
  );
  return normalizeAssetHistory(unwrap(data, "Failed to retry asset generation"));
}

export async function listStudioAssetVariants(
  projectId: number,
  assetId: number,
  params?: { page?: number; size?: number }
): Promise<StudioAssetResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageData<StudioAssetResponse>>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/variants`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load asset variants").map(normalizeAsset);
}

export async function deleteStudioAssetHistory(
  projectId: number,
  assetId: number,
  historyId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/creative/projects/${projectId}/entities/${assetId}/versions/${historyId}`
  );
  if (data.code !== 0) {
    const err = new Error(data.msg || "Failed to delete asset history") as Error & {
      code?: number;
    };
    err.code = data.code;
    throw err;
  }
}

export async function getStudioAiModels(
  type?: "text" | "image" | "video"
): Promise<StudioAiModelListResponse> {
  const { data } = await apiClient.get<ApiEnvelope<StudioAiModelListResponse>>(
    "/api/v1/creative/ai/models",
    { params: type ? { type } : undefined }
  );
  return normalizeModels(unwrap(data, "Failed to load AI models"));
}

export const listStudioSessions = listStudioWorkflows;
export const createStudioSession = createStudioWorkflow;
export const listStudioSessionNodes = listStudioWorkflowNodes;
export const getStudioSessionNode = getStudioWorkflowNode;
export const retryStudioSessionNode = retryStudioWorkflowNode;
export const listStudioEntities = listStudioAssets;
export const createStudioEntity = createStudioAsset;
export const updateStudioEntity = updateStudioAsset;
export const deleteStudioEntity = deleteStudioAsset;
export const listStudioEntityVersions = listStudioAssetHistories;
export const createStudioEntityGeneration = createStudioAssetGeneration;
export const retryStudioEntityGeneration = retryStudioAssetGeneration;
export const listStudioEntityVariants = listStudioAssetVariants;
export const deleteStudioEntityVersion = deleteStudioAssetHistory;

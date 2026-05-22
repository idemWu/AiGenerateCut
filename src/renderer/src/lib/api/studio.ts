import apiClient from "./client";
import type { components } from "./schema";

type StudioProjectResponse = components["schemas"]["StudioProjectResponse"];
type StudioTimelineTrackResponse = components["schemas"]["StudioTimelineTrackResponse"];
type StudioClipResponse = components["schemas"]["StudioClipResponse"];
type StudioWorkflowResponse = components["schemas"]["StudioWorkflowResponse"];
type StudioWorkflowNodeResponse = components["schemas"]["StudioWorkflowNodeResponse"];
type StudioKeyframeResponse = components["schemas"]["StudioKeyframeResponse"];
type StudioAssetResponse = components["schemas"]["StudioAssetResponse"];
type StudioAiModelListResponse = components["schemas"]["StudioAiModelListResponse"];
type CreateStudioProjectRequest = components["schemas"]["CreateStudioProjectRequest"];
type CreateStudioWorkflowRequest = components["schemas"]["CreateStudioWorkflowRequest"];
type CreateStudioClipRequest = components["schemas"]["CreateStudioClipRequest"];
type UpdateStudioClipRequest = components["schemas"]["UpdateStudioClipRequest"];
type UpdateStudioClipContentRequest = components["schemas"]["UpdateStudioClipContentRequest"];
type CreateStudioTextGenerationRequest =
  components["schemas"]["CreateStudioTextGenerationRequest"];
type CreateStudioImageGenerationRequest =
  components["schemas"]["CreateStudioImageGenerationRequest"];
type CreateStudioVideoGenerationRequest =
  components["schemas"]["CreateStudioVideoGenerationRequest"];
type CreateStudioKeyframeRequest = components["schemas"]["CreateStudioKeyframeRequest"];
type CreateStudioTimelineTrackRequest =
  components["schemas"]["CreateStudioTimelineTrackRequest"];
type CreateStudioAssetRequest = components["schemas"]["CreateStudioAssetRequest"];
type CreateStudioAssetGenerationRequest =
  components["schemas"]["CreateStudioAssetGenerationRequest"];
type UpdateStudioAssetRequest = components["schemas"]["UpdateStudioAssetRequest"];
type SelectStudioAssetImageRequest = components["schemas"]["SelectStudioAssetImageRequest"];
type StudioAssetHistoryResponse = components["schemas"]["StudioAssetHistoryResponse"];
type StudioAssetType = components["schemas"]["StudioAssetType"];

/** 后端扩展：支持 text_content 持久化 */
export type StudioUpdateClipRequest = UpdateStudioClipRequest & {
  text_content?: string | null;
};

export type { StudioClipTransform } from "@/lib/studio/composition/clipTransform";
type PageDataStudioProject = components["schemas"]["PageData_StudioProjectResponse_"];
type PageDataStudioWorkflow = components["schemas"]["PageData_StudioWorkflowResponse_"];
type PageDataStudioWorkflowNode = components["schemas"]["PageData_StudioWorkflowNodeResponse_"];
type PageDataStudioKeyframe = components["schemas"]["PageData_StudioKeyframeResponse_"];
type PageDataStudioAsset = components["schemas"]["PageData_StudioAssetResponse_"];
type PageDataStudioAssetHistory =
  components["schemas"]["PageData_StudioAssetHistoryResponse_"];

interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type {
  StudioProjectResponse,
  StudioTimelineTrackResponse,
  StudioClipResponse,
  StudioWorkflowResponse,
  StudioWorkflowNodeResponse,
  StudioKeyframeResponse,
  StudioAssetResponse,
  StudioAssetHistoryResponse,
  StudioAssetType,
  StudioAiModelListResponse,
  CreateStudioAssetRequest,
  CreateStudioAssetGenerationRequest,
  UpdateStudioAssetRequest,
  SelectStudioAssetImageRequest,
  CreateStudioProjectRequest,
  CreateStudioClipRequest,
  UpdateStudioClipRequest,
};

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

export async function listStudioProjects(params?: {
  page?: number;
  size?: number;
}): Promise<PageDataStudioProject> {
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioProject>>(
    "/api/v1/studio/projects",
    { params }
  );
  return unwrap(data, "Failed to load studio projects");
}

export async function createStudioProject(
  body: CreateStudioProjectRequest
): Promise<StudioProjectResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioProjectResponse>>(
    "/api/v1/studio/projects",
    body
  );
  return unwrap(data, "Failed to create studio project");
}

export async function getStudioProject(projectId: number): Promise<StudioProjectResponse> {
  const { data } = await apiClient.get<ApiEnvelope<StudioProjectResponse>>(
    `/api/v1/studio/projects/${projectId}`
  );
  return unwrap(data, "Failed to load studio project");
}

export async function listStudioTracks(
  projectId: number
): Promise<StudioTimelineTrackResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<StudioTimelineTrackResponse[]>>(
    `/api/v1/studio/projects/${projectId}/tracks`
  );
  return unwrap(data, "Failed to load tracks");
}

export async function createStudioTrack(
  projectId: number,
  body?: CreateStudioTimelineTrackRequest
): Promise<StudioTimelineTrackResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioTimelineTrackResponse>>(
    `/api/v1/studio/projects/${projectId}/tracks`,
    body ?? {}
  );
  return unwrap(data, "Failed to create track");
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
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioWorkflow>>(
    `/api/v1/studio/projects/${projectId}/workflows`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load workflows");
}

export async function createStudioWorkflow(
  projectId: number,
  body: CreateStudioWorkflowRequest
): Promise<StudioWorkflowResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows`,
    body
  );
  return unwrap(data, "Failed to create workflow");
}

export async function listStudioWorkflowNodes(
  projectId: number,
  workflowId: number,
  params?: { page?: number; size?: number }
): Promise<StudioWorkflowNodeResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioWorkflowNode>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/nodes`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load workflow nodes");
}

export async function getStudioWorkflowNode(
  projectId: number,
  workflowId: number,
  nodeId: number
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.get<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/nodes/${nodeId}`,
    { timeout: 30_000 }
  );
  return unwrap(data, "Failed to load workflow node");
}

export async function retryStudioWorkflowNode(
  projectId: number,
  workflowId: number,
  nodeId: number
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/nodes/${nodeId}/retry`
  );
  return unwrap(data, "Failed to retry node");
}

export async function createStudioTextGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioTextGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/text-generations`,
    body,
    { timeout: 120_000 }
  );
  return unwrap(data, "Text generation failed");
}

export async function createStudioImageGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioImageGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/image-generations`,
    body
  );
  return unwrap(data, "Image generation failed");
}

export async function createStudioVideoGeneration(
  projectId: number,
  workflowId: number,
  body: CreateStudioVideoGenerationRequest
): Promise<StudioWorkflowNodeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioWorkflowNodeResponse>>(
    `/api/v1/studio/projects/${projectId}/workflows/${workflowId}/video-generations`,
    body
  );
  return unwrap(data, "Video generation failed");
}

export async function createStudioClip(
  projectId: number,
  body: CreateStudioClipRequest
): Promise<StudioClipResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioClipResponse>>(
    `/api/v1/studio/projects/${projectId}/clips`,
    body
  );
  return unwrap(data, "Failed to create clip");
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
  return unwrap(data, "Failed to update clip");
}

export async function updateStudioClipContent(
  projectId: number,
  clipId: number,
  body: UpdateStudioClipContentRequest
): Promise<StudioClipResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioClipResponse>>(
    `/api/v1/studio/projects/${projectId}/clips/${clipId}/content`,
    body
  );
  return unwrap(data, "Failed to update clip content");
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
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioKeyframe>>(
    `/api/v1/studio/projects/${projectId}/keyframes`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load keyframes");
}

export async function createStudioKeyframe(
  projectId: number,
  body: CreateStudioKeyframeRequest
): Promise<StudioKeyframeResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioKeyframeResponse>>(
    `/api/v1/studio/projects/${projectId}/keyframes`,
    body
  );
  return unwrap(data, "Failed to create keyframe");
}

export async function listStudioAssets(
  projectId: number,
  params?: { asset_type?: StudioAssetType; page?: number; size?: number }
): Promise<StudioAssetResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioAsset>>(
    `/api/v1/studio/projects/${projectId}/assets`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load assets");
}

export async function createStudioAsset(
  projectId: number,
  body: CreateStudioAssetRequest
): Promise<StudioAssetResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/studio/projects/${projectId}/assets`,
    body,
    { timeout: 30_000 }
  );
  return unwrap(data, "Failed to create asset");
}

export async function updateStudioAsset(
  projectId: number,
  assetId: number,
  body: UpdateStudioAssetRequest
): Promise<StudioAssetResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}`,
    body
  );
  return unwrap(data, "Failed to update asset");
}

export async function deleteStudioAsset(
  projectId: number,
  assetId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}`
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
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioAssetHistory>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/histories`,
    { params, timeout: 30_000 }
  );
  return unwrapPageItems(data, "Failed to load asset histories");
}

export async function createStudioAssetGeneration(
  projectId: number,
  assetId: number,
  body: CreateStudioAssetGenerationRequest
): Promise<StudioAssetHistoryResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetHistoryResponse>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/generations`,
    body,
    { timeout: 30_000 }
  );
  return unwrap(data, "Asset generation failed");
}

export async function selectStudioAssetCurrentImage(
  projectId: number,
  assetId: number,
  body: SelectStudioAssetImageRequest
): Promise<StudioAssetResponse> {
  const { data } = await apiClient.put<ApiEnvelope<StudioAssetResponse>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/current-image`,
    body
  );
  return unwrap(data, "Failed to set asset image");
}

export async function retryStudioAssetGeneration(
  projectId: number,
  assetId: number,
  historyId: number
): Promise<StudioAssetHistoryResponse> {
  const { data } = await apiClient.post<ApiEnvelope<StudioAssetHistoryResponse>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/generations/${historyId}/retry`
  );
  return unwrap(data, "Failed to retry asset generation");
}

export async function listStudioAssetVariants(
  projectId: number,
  assetId: number,
  params?: { page?: number; size?: number }
): Promise<StudioAssetResponse[]> {
  const { data } = await apiClient.get<ApiEnvelope<PageDataStudioAsset>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/variants`,
    { params }
  );
  return unwrapPageItems(data, "Failed to load asset variants");
}

export async function deleteStudioAssetHistory(
  projectId: number,
  assetId: number,
  historyId: number
): Promise<void> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(
    `/api/v1/studio/projects/${projectId}/assets/${assetId}/histories/${historyId}`
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
    "/api/v1/studio/ai/models",
    { params: type ? { type } : undefined }
  );
  return unwrap(data, "Failed to load AI models");
}

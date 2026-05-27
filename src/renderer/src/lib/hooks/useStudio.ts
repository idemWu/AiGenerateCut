"use client";

import useSWR from "swr";
import {
  getStudioProject,
  listStudioProjects,
  listStudioTracks,
  listStudioWorkflows,
  listStudioWorkflowNodes,
  listStudioKeyframes,
  listStudioAssets,
  listStudioAssetVariants,
  getStudioAiModels,
  type StudioAssetType,
} from "@/lib/api/studio";

const DEDUPING_INTERVAL_MS = 5000;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function useStudioProjects(page = 1, size = 20, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const key = enabled ? ["studio-projects", page, size] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioProjects({ page, size }) : null,
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false }
  );
  return { projects: data?.items ?? [], total: data?.total ?? 0, isLoading, isError: !!error, mutate };
}

export function useStudioProject(projectId: number | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false && projectId != null;
  const key = enabled ? ["studio-project", projectId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => getStudioProject(projectId!) : null,
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false }
  );
  return { project: data, isLoading, isError: !!error, mutate };
}

export function useStudioTracks(projectId: number | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false && projectId != null;
  const key = enabled ? ["studio-tracks", projectId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioTracks(projectId!) : null,
    { dedupingInterval: 2000, revalidateOnFocus: false }
  );
  return { tracks: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioWorkflows(projectId: number | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false && projectId != null;
  const key = enabled ? ["studio-workflows", projectId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioWorkflows(projectId!) : null,
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false }
  );
  return { workflows: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioSessions(projectId: number | null, options?: { enabled?: boolean }) {
  const result = useStudioWorkflows(projectId, options);
  return {
    sessions: result.workflows,
    isLoading: result.isLoading,
    isError: result.isError,
    mutate: result.mutate,
  };
}

export function useStudioWorkflowNodes(
  projectId: number | null,
  workflowId: number | null,
  options?: { enabled?: boolean }
) {
  const enabled =
    options?.enabled !== false && projectId != null && workflowId != null;
  const key = enabled ? ["studio-nodes", projectId, workflowId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioWorkflowNodes(projectId!, workflowId!) : null,
    { dedupingInterval: 2000, revalidateOnFocus: false }
  );
  return { nodes: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioSessionNodes(
  projectId: number | null,
  sessionId: number | null,
  options?: { enabled?: boolean }
) {
  return useStudioWorkflowNodes(projectId, sessionId, options);
}

export function useStudioKeyframes(projectId: number | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false && projectId != null;
  const key = enabled ? ["studio-keyframes", projectId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioKeyframes(projectId!) : null,
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false }
  );
  return { keyframes: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioAssets(
  projectId: number | null,
  assetType?: StudioAssetType | null,
  options?: { enabled?: boolean; refreshInterval?: number }
) {
  const enabled = options?.enabled !== false && projectId != null;
  const key = enabled ? ["studio-assets", projectId, assetType ?? "all"] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key
      ? () =>
          listStudioAssets(projectId!, {
            asset_type: assetType ?? undefined,
          })
      : null,
    {
      dedupingInterval: DEDUPING_INTERVAL_MS,
      revalidateOnFocus: false,
      refreshInterval: options?.refreshInterval,
    }
  );
  return { assets: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioAssetVariants(
  projectId: number | null,
  parentAssetId: number | null,
  options?: { enabled?: boolean }
) {
  const enabled =
    options?.enabled !== false && projectId != null && parentAssetId != null;
  const key = enabled
    ? ["studio-asset-variants", projectId, parentAssetId]
    : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioAssetVariants(projectId!, parentAssetId!) : null,
    { dedupingInterval: DEDUPING_INTERVAL_MS, revalidateOnFocus: false }
  );
  return { variants: asArray(data), isLoading, isError: !!error, mutate };
}

export function useStudioAiModels(type?: "text" | "image" | "video") {
  const key = ["studio-ai-models", type ?? "all"];
  const { data, error, isLoading } = useSWR(
    key,
    () => getStudioAiModels(type),
    { dedupingInterval: 60_000, revalidateOnFocus: false }
  );
  return { models: data, isLoading, isError: !!error };
}

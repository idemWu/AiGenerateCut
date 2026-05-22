"use client";

import useSWR from "swr";
import { listStudioAssetHistories } from "@/lib/api/studio";

const DEDUPING_INTERVAL_MS = 2000;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function useStudioAssetHistories(
  projectId: number | null,
  assetId: number | null,
  options?: { enabled?: boolean; refreshInterval?: number }
) {
  const enabled =
    options?.enabled !== false && projectId != null && assetId != null;
  const key = enabled ? ["studio-asset-histories", projectId, assetId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listStudioAssetHistories(projectId!, assetId!) : null,
    {
      dedupingInterval: DEDUPING_INTERVAL_MS,
      revalidateOnFocus: false,
      refreshInterval: options?.refreshInterval,
    }
  );
  return { histories: asArray(data), isLoading, isError: !!error, mutate };
}

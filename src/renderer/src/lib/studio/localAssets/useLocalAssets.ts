"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import {
  listLocalMediaAssets,
  pickLocalMediaFolder,
  setLocalMediaFolder,
} from "./localAssetsApi";

export function useLocalAssets(projectId: number | null) {
  const [selectingFolder, setSelectingFolder] = useState(false);
  const key = projectId != null ? ["studio-local-assets", projectId] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    key ? () => listLocalMediaAssets(projectId!) : null,
    { revalidateOnFocus: false }
  );

  const pickFolder = useCallback(async () => {
    if (projectId == null) return null;
    setSelectingFolder(true);
    try {
      const folderPath = await pickLocalMediaFolder();
      if (!folderPath) return data ?? null;
      const next = await setLocalMediaFolder(projectId, folderPath);
      await mutate(next, { revalidate: false });
      return next;
    } finally {
      setSelectingFolder(false);
    }
  }, [data, mutate, projectId]);

  return {
    folderPath: data?.folderPath ?? null,
    assets: data?.assets ?? [],
    isLoading,
    isError: !!error,
    selectingFolder,
    pickFolder,
    refresh: mutate,
  };
}

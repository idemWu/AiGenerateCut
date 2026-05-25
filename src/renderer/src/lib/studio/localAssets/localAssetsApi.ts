import type { LocalAsset, LocalAssetProject } from "./types";

function getLocalMediaApi() {
  if (!window.localMedia) {
    throw new Error("Local media API is unavailable");
  }
  return window.localMedia;
}

export async function pickLocalMediaFolder(): Promise<string | null> {
  return getLocalMediaApi().pickFolder();
}

export async function setLocalMediaFolder(
  projectId: number,
  folderPath: string
): Promise<LocalAssetProject> {
  return getLocalMediaApi().setFolder(projectId, folderPath);
}

export async function listLocalMediaAssets(
  projectId: number
): Promise<LocalAssetProject> {
  return getLocalMediaApi().list(projectId);
}

export async function getLocalMediaAsset(
  projectId: number,
  assetId: string
): Promise<LocalAsset | null> {
  return getLocalMediaApi().get(projectId, assetId);
}

export async function setLocalMediaDuration(
  projectId: number,
  assetId: string,
  durationSec: number
): Promise<LocalAsset | null> {
  return getLocalMediaApi().setDuration(projectId, assetId, durationSec);
}

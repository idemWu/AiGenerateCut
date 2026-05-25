export type LocalAssetMediaType = "image" | "video";

export interface LocalAsset {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  mediaType: LocalAssetMediaType;
  size: number;
  mtimeMs: number;
  durationSec?: number;
  exists: boolean;
}

export interface LocalAssetProject {
  folderPath: string | null;
  assets: LocalAsset[];
}

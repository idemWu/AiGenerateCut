export const LOCAL_ASSET_OBJECT_KEY_PREFIX = "studio-local:";

export function makeLocalAssetObjectKey(assetId: string): string {
  return `${LOCAL_ASSET_OBJECT_KEY_PREFIX}${assetId}`;
}

export function parseLocalAssetObjectKey(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("studio-local://")) {
    const assetId = raw.slice("studio-local://".length);
    return assetId ? decodeURIComponent(assetId) : null;
  }
  if (!raw.startsWith(LOCAL_ASSET_OBJECT_KEY_PREFIX)) return null;
  const assetId = raw.slice(LOCAL_ASSET_OBJECT_KEY_PREFIX.length);
  return assetId || null;
}

export function localAssetProtocolUrl(assetId: string): string {
  return `studio-local://${encodeURIComponent(assetId)}`;
}

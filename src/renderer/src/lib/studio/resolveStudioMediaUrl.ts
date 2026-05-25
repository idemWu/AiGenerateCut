import {
  localAssetProtocolUrl,
  parseLocalAssetObjectKey,
} from "@/lib/studio/localAssets/localAssetUrl";

const R2_IMAGE_BASE =
  import.meta.env.VITE_R2_IMAGE_HOSTNAME
    ? `https://${import.meta.env.VITE_R2_IMAGE_HOSTNAME}`
    : "";

/** 将 API 返回的 object_url 或 object_key 转为可加载的完整 URL */
export function resolveStudioMediaUrl(
  urlOrKey: string | null | undefined
): string | null {
  const raw = urlOrKey?.trim();
  if (!raw) return null;
  const localAssetId = parseLocalAssetObjectKey(raw);
  if (localAssetId) return localAssetProtocolUrl(localAssetId);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!R2_IMAGE_BASE) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${R2_IMAGE_BASE}${path}`;
}

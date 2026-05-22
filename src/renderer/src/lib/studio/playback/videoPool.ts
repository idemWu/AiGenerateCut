import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import { loadVideo } from "@/lib/studio/export/mediaCache";

/** 预览池 key：每个 clip 独立 video 元素，避免同源 URL 叠层共用一个 currentTime。 */
export function clipPoolKey(clip: StudioClipResponse): string {
  return `clip:${clip.id}`;
}

export function clipIdFromPoolKey(key: string): number | null {
  if (!key.startsWith("clip:")) return null;
  const id = Number.parseInt(key.slice(5), 10);
  return Number.isFinite(id) ? id : null;
}

const pendingLoads = new WeakMap<
  Map<string, HTMLVideoElement>,
  Map<string, Promise<HTMLVideoElement>>
>();

/** 取或创建给定 clip 的 pool 视频；并发请求复用同一 inflight Promise。 */
export async function ensurePoolVideoForClip(
  pool: Map<string, HTMLVideoElement>,
  clip: StudioClipResponse
): Promise<HTMLVideoElement> {
  const key = clipPoolKey(clip);
  const url = clip.media_url;
  if (!url) {
    throw new Error("Clip has no media_url");
  }

  const existing = pool.get(key);
  if (existing) return existing;

  let pending = pendingLoads.get(pool);
  if (!pending) {
    pending = new Map();
    pendingLoads.set(pool, pending);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = loadVideo(url)
    .then((video) => {
      pool.set(key, video);
      pending!.delete(key);
      return video;
    })
    .catch((err) => {
      pending!.delete(key);
      throw err;
    });
  pending.set(key, promise);
  return promise;
}

export function removeClipFromVideoPool(
  pool: Map<string, HTMLVideoElement>,
  clipId: number
): void {
  const key = `clip:${clipId}`;
  const video = pool.get(key);
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    pool.delete(key);
  }
}

/** 移除时间轴上已不存在的 clip 对应池项，释放解码器。 */
export function pruneVideoPool(
  pool: Map<string, HTMLVideoElement>,
  tracks: StudioTimelineTrackResponse[]
): void {
  const activeIds = new Set<number>();
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (clip.media_type === "video" && clip.media_url) {
        activeIds.add(clip.id);
      }
    }
  }
  for (const key of [...pool.keys()]) {
    const clipId = clipIdFromPoolKey(key);
    if (clipId != null && !activeIds.has(clipId)) {
      removeClipFromVideoPool(pool, clipId);
    }
  }
}

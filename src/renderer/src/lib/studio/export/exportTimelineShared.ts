import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import type { CanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import { aspectRatioToCanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import { renderFrameToCanvas } from "@/lib/studio/composition/renderFrame";
import { clipPoolKey } from "@/lib/studio/playback/videoPool";
import { resolveClipsAtTimeSorted } from "@/lib/studio/playback/resolveClipsAtTime";
import { loadImage, loadVideo, seekVideoAsync } from "./mediaCache";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

export type ExportPhase = "prepare" | "loadWasm" | "encode" | "mux";

export interface ExportProgress {
  phase: ExportPhase;
  progress: number;
  /** 是否使用 FFmpeg 兼容模式 */
  compatMode?: boolean;
}

export interface ExportTimelineOptions {
  tracks: StudioTimelineTrackResponse[];
  durationSec: number;
  aspectRatio: StudioAspectRatio;
  fps?: number;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
}

export interface ExportMediaMaps {
  imageMap: Map<string, HTMLImageElement>;
  /** key = clipPoolKey(clip)，每层独立 video 元素 */
  videoMap: Map<string, HTMLVideoElement>;
}

export function getExportCanvasSize(aspectRatio: StudioAspectRatio): CanvasSize {
  return aspectRatioToCanvasSize(aspectRatio);
}

export async function prepareExportMedia(
  tracks: StudioTimelineTrackResponse[],
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<ExportMediaMaps> {
  const imageMap = new Map<string, HTMLImageElement>();
  const videoMap = new Map<string, HTMLVideoElement>();

  const imageUrls = new Set<string>();
  const videoClips: StudioClipResponse[] = [];

  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      if (!clip.media_url) continue;
      if (clip.media_type === "image") {
        imageUrls.add(clip.media_url);
      } else if (clip.media_type === "video") {
        videoClips.push(clip);
      }
    }
  }

  const total = imageUrls.size + videoClips.length || 1;
  let loaded = 0;
  onProgress?.(0, total);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  await Promise.all([
    ...Array.from(imageUrls).map(async (url) => {
      const img = await loadImage(url);
      if (signal?.aborted) return;
      imageMap.set(url, img);
      loaded += 1;
      onProgress?.(loaded, total);
    }),
    ...videoClips.map(async (clip) => {
      const url = clip.media_url!;
      const video = await loadVideo(url);
      if (signal?.aborted) return;
      videoMap.set(clipPoolKey(clip), video);
      loaded += 1;
      onProgress?.(loaded, total);
    }),
  ]);

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  return { imageMap, videoMap };
}

export async function renderExportFrame(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  /** 必须已按导出绘制顺序排好序（参见 sortTracksForRender），避免热路径里每帧重复 sort。 */
  sortedTracks: StudioTimelineTrackResponse[],
  timeSec: number,
  maps: ExportMediaMaps
): Promise<void> {
  const layers = resolveClipsAtTimeSorted(sortedTracks, timeSec);

  const seekTasks: Promise<void>[] = [];
  for (const { clip } of layers) {
    if (clip.media_type === "video" && clip.media_url) {
      const video = maps.videoMap.get(clipPoolKey(clip));
      if (video) {
        const mediaStart = clip.media_start_sec ?? 0;
        const target = Math.max(0, mediaStart + (timeSec - clip.start_sec));
        seekTasks.push(seekVideoAsync(video, target));
      }
    }
  }
  await Promise.all(seekTasks);

  renderFrameToCanvas(ctx, size, layers, {
    getImageElement: (url) => maps.imageMap.get(url),
    getVideoElement: (clip) => maps.videoMap.get(clipPoolKey(clip)),
  });
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode frame"));
      },
      "image/jpeg",
      quality
    );
  });
}

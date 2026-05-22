import type { StudioClipResponse } from "@/lib/api/studio";
import type { TrackClipAtTime } from "@/lib/studio/playback/resolveClipsAtTime";
import { getClipTextContent, isPlaceholderClip } from "@/lib/studio/studioClipUtils";
import type { CanvasSize } from "./aspectRatioSize";
import {
  computeMediaDrawRect,
  drawMediaInRect,
  drawTransformedRect,
  readClipTransform,
} from "./clipTransform";
import { buildCanvasFilter, readClipFilter } from "./clipFilter";
import { measurePlaceholderClipSource } from "./clipTransform";
import { drawTextLinesInBox } from "./textClipLayout";

export interface RenderFrameSources {
  getVideoElement: (clip: StudioClipResponse) => HTMLVideoElement | undefined;
  getImageElement: (url: string) => HTMLImageElement | undefined;
}

export interface RenderFrameOptions {
  /** 预览专用：无 text_content 时显示的占位文案（导出勿传） */
  previewTextPlaceholder?: string;
  /** 预览内联编辑时跳过绘制（避免与 textarea 重影） */
  hidePlaceholderClipId?: number | null;
}

function getSourceSize(source: CanvasImageSource): { width: number; height: number } | null {
  const sw =
    "videoWidth" in source
      ? (source as HTMLVideoElement).videoWidth
      : (source as HTMLImageElement).naturalWidth;
  const sh =
    "videoHeight" in source
      ? (source as HTMLVideoElement).videoHeight
      : (source as HTMLImageElement).naturalHeight;
  if (!sw || !sh) return null;
  return { width: sw, height: sh };
}

function drawPlaceholderClip(
  ctx: CanvasRenderingContext2D,
  clip: StudioClipResponse,
  size: CanvasSize,
  transform: ReturnType<typeof readClipTransform>,
  previewPlaceholder?: string
): void {
  const content = getClipTextContent(clip);
  const sourceSize = measurePlaceholderClipSource(ctx, clip, size, {
    previewTextPlaceholder: previewPlaceholder,
  });
  const rect = computeMediaDrawRect(size, sourceSize, transform);
  const isPlaceholderHint = !content && previewPlaceholder !== undefined;
  const displayText = content ?? (isPlaceholderHint ? previewPlaceholder : null);

  drawTransformedRect(ctx, rect, () => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(0, 0, rect.width, rect.height);
    ctx.setLineDash([]);

    if (displayText) {
      drawTextLinesInBox(
        ctx,
        displayText,
        rect.width,
        rect.height,
        isPlaceholderHint ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.88)"
      );
    }
  });
}

function drawMediaWithClipFilter(
  ctx: CanvasRenderingContext2D,
  clip: StudioClipResponse,
  draw: () => void
): void {
  const filter = buildCanvasFilter(readClipFilter(clip));
  if (filter === "none") {
    draw();
    return;
  }

  ctx.save();
  ctx.filter = filter;
  draw();
  ctx.restore();
}

export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  layers: TrackClipAtTime[],
  sources: RenderFrameSources,
  options?: RenderFrameOptions
): void {
  const previewPlaceholder = options?.previewTextPlaceholder;
  const hidePlaceholderClipId = options?.hidePlaceholderClipId ?? null;

  // 兜底防线：若实际渲染的顶层是 video 但还没 ready（seek 中 / load 中），整帧 skip
  // 保留上一帧 canvas 内容，避免「顶层不画 → 下层暴露」造成的「多轨同时显示」错乱。
  // 顶层 = layers[last]（已经过 promoteSelectedClipLayer 处理）。
  const topLayer = layers[layers.length - 1];
  if (topLayer && topLayer.clip.media_type === "video" && topLayer.clip.media_url) {
    const topVideo = sources.getVideoElement(topLayer.clip);
    if (!topVideo || topVideo.readyState < 2) {
      return;
    }
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);

  for (const { clip } of layers) {
    const transform = readClipTransform(clip);

    if (clip.media_type === "video" && clip.media_url) {
      const video = sources.getVideoElement(clip);
      if (video && video.readyState >= 2) {
        const sourceSize = getSourceSize(video);
        if (sourceSize) {
          const rect = computeMediaDrawRect(size, sourceSize, transform);
          drawMediaWithClipFilter(ctx, clip, () => drawMediaInRect(ctx, video, rect));
        }
      }
      continue;
    }

    if (clip.media_type === "image" && clip.media_url) {
      const img = sources.getImageElement(clip.media_url);
      if (img?.complete && img.naturalWidth) {
        const sourceSize = getSourceSize(img);
        if (sourceSize) {
          const rect = computeMediaDrawRect(size, sourceSize, transform);
          drawMediaWithClipFilter(ctx, clip, () => drawMediaInRect(ctx, img, rect));
        }
      }
      continue;
    }

    if (isPlaceholderClip(clip)) {
      const content = getClipTextContent(clip);
      if (!content && previewPlaceholder === undefined) {
        continue;
      }
      if (hidePlaceholderClipId != null && hidePlaceholderClipId === clip.id) {
        continue;
      }
      drawPlaceholderClip(ctx, clip, size, transform, previewPlaceholder);
    }
  }
}

/** 预览用：合并草稿正文 */
export function applyClipWithTextContent(
  clip: StudioClipResponse,
  textContent: string
): StudioClipResponse {
  return { ...clip, text_content: textContent };
}

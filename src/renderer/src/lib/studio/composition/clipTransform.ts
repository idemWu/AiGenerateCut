import type { StudioClipResponse } from "@/lib/api/studio";
import { getClipTextContent, isPlaceholderClip } from "@/lib/studio/studioClipUtils";
import { measureTextClipSourceSize, TEXT_CLIP_FONT } from "./textClipLayout";
import type { CanvasSize } from "./aspectRatioSize";

export interface StudioClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface SourceSize {
  width: number;
  height: number;
}

export interface MediaDrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotation: number;
}

export interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_TRANSFORM: StudioClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

function readTransformRecord(
  raw: StudioClipResponse["transform"] | undefined
): { [key: string]: unknown } {
  if (!raw || typeof raw !== "object") return {};
  return raw as { [key: string]: unknown };
}

export function readClipTransform(clip: StudioClipResponse): StudioClipTransform {
  const raw = clip.transform;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TRANSFORM };
  const t = raw as Record<string, unknown>;
  return normalizeTransform({
    x: typeof t.x === "number" ? t.x : 0,
    y: typeof t.y === "number" ? t.y : 0,
    scale: typeof t.scale === "number" ? t.scale : 1,
    rotation: typeof t.rotation === "number" ? t.rotation : 0,
  });
}

export function normalizeTransform(partial: Partial<StudioClipTransform>): StudioClipTransform {
  return {
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    scale: Math.max(0.05, partial.scale ?? 1),
    rotation: partial.rotation ?? 0,
  };
}

export function transformToPayload(t: StudioClipTransform): StudioClipTransform {
  return {
    x: Math.round(t.x * 1000) / 1000,
    y: Math.round(t.y * 1000) / 1000,
    scale: Math.round(t.scale * 1000) / 1000,
    rotation: Math.round(t.rotation * 1000) / 1000,
  };
}

/** API / clip 对象上的 transform 字段 */
export function transformToApiRecord(
  t: StudioClipTransform,
  base?: StudioClipResponse["transform"] | null
): {
  [key: string]: unknown;
} {
  return {
    ...readTransformRecord(base),
    ...transformToPayload(t),
  };
}

/** contain  fit + transform，与 renderFrame drawMediaFit 一致 */
export function computeMediaDrawRect(
  canvasSize: CanvasSize,
  sourceSize: SourceSize,
  transform: StudioClipTransform
): MediaDrawRect {
  const { width: sw, height: sh } = sourceSize;
  if (sw <= 0 || sh <= 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      centerX: canvasSize.width / 2,
      centerY: canvasSize.height / 2,
      rotation: transform.rotation,
    };
  }

  const scale = transform.scale;
  const fitScale = Math.min(canvasSize.width / sw, canvasSize.height / sh) * scale;
  const width = sw * fitScale;
  const height = sh * fitScale;
  const x = transform.x + (canvasSize.width - width) / 2;
  const y = transform.y + (canvasSize.height - height) / 2;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    rotation: transform.rotation,
  };
}

/** empty 占位框默认占画布内边距区域 */
export function computeEmptyPlaceholderSourceSize(canvasSize: CanvasSize): SourceSize {
  const pad = 24;
  return {
    width: canvasSize.width - pad * 2,
    height: canvasSize.height - pad * 2,
  };
}

/** 文本块默认虚拟尺寸（用于 transform 框） */
export function computeTextSourceSize(canvasSize: CanvasSize): SourceSize {
  return {
    width: canvasSize.width * 0.85,
    height: canvasSize.height * 0.4,
  };
}

export function parseAspectRatioString(ratio: string | null | undefined): number | null {
  if (!ratio) return null;
  const parts = ratio.split(":").map((p) => Number(p.trim()));
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return parts[0] / parts[1];
}

export function clipFallbackSourceSize(
  clip: StudioClipResponse,
  canvasSize: CanvasSize
): SourceSize {
  const ar = parseAspectRatioString(clip.aspect_ratio ?? null);
  if (ar != null && ar > 0) {
    const maxW = canvasSize.width * 0.9;
    const maxH = canvasSize.height * 0.9;
    if (ar >= 1) {
      const width = maxW;
      return { width, height: width / ar };
    }
    const height = maxH;
    return { width: height * ar, height };
  }
  return { width: canvasSize.width, height: canvasSize.height };
}

export function applyClipWithTransform(
  clip: StudioClipResponse,
  transform: StudioClipTransform
): StudioClipResponse {
  return {
    ...clip,
    transform: transformToApiRecord(transform, clip.transform),
  };
}

/** object-contain：canvas 在屏幕上的实际显示区域 */
export function getCanvasDisplayRect(
  canvasBounds: DOMRect,
  canvasSize: CanvasSize
): DisplayRect {
  const scale = Math.min(canvasBounds.width / canvasSize.width, canvasBounds.height / canvasSize.height);
  const width = canvasSize.width * scale;
  const height = canvasSize.height * scale;
  const left = canvasBounds.left + (canvasBounds.width - width) / 2;
  const top = canvasBounds.top + (canvasBounds.height - height) / 2;
  return { left, top, width, height };
}

export function canvasToScreen(
  point: { x: number; y: number },
  displayRect: DisplayRect,
  canvasSize: CanvasSize
): { x: number; y: number } {
  const scaleX = displayRect.width / canvasSize.width;
  const scaleY = displayRect.height / canvasSize.height;
  return {
    x: displayRect.left + point.x * scaleX,
    y: displayRect.top + point.y * scaleY,
  };
}

export function screenToCanvas(
  point: { x: number; y: number },
  displayRect: DisplayRect,
  canvasSize: CanvasSize
): { x: number; y: number } {
  const scaleX = displayRect.width / canvasSize.width;
  const scaleY = displayRect.height / canvasSize.height;
  return {
    x: (point.x - displayRect.left) / scaleX,
    y: (point.y - displayRect.top) / scaleY,
  };
}

export function drawTransformedRect(
  ctx: CanvasRenderingContext2D,
  rect: MediaDrawRect,
  draw: () => void
): void {
  ctx.save();
  ctx.translate(rect.centerX, rect.centerY);
  if (rect.rotation) ctx.rotate((rect.rotation * Math.PI) / 180);
  ctx.translate(-rect.width / 2, -rect.height / 2);
  draw();
  ctx.restore();
}

export function drawMediaInRect(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  rect: MediaDrawRect
): void {
  drawTransformedRect(ctx, rect, () => {
    ctx.drawImage(source, 0, 0, rect.width, rect.height);
  });
}

export function hitTestCanvasPointInRect(
  point: { x: number; y: number },
  rect: MediaDrawRect
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const dx = point.x - rect.centerX;
  const dy = point.y - rect.centerY;
  const rad = (-rect.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= rect.width / 2 && Math.abs(ly) <= rect.height / 2;
}

export interface ClipMediaSources {
  getVideoElement?: (clip: StudioClipResponse) => HTMLVideoElement | undefined;
  getImageElement?: (url: string) => HTMLImageElement | undefined;
}

export interface MeasurePlaceholderClipOptions {
  previewTextPlaceholder?: string;
  draftText?: string | null;
}

/** 与 renderFrame / 预览 transform 框共用同一套文字测量 */
export function measurePlaceholderClipSource(
  ctx: CanvasRenderingContext2D,
  clip: StudioClipResponse,
  canvasSize: CanvasSize,
  options: MeasurePlaceholderClipOptions = {}
): SourceSize {
  const trimmedDraft = options.draftText?.trim();
  const content =
    options.draftText !== null && options.draftText !== undefined
      ? trimmedDraft || null
      : getClipTextContent(clip);
  const measureText =
    content ??
    (options.previewTextPlaceholder !== undefined ? options.previewTextPlaceholder : "");
  if (!measureText) {
    return { width: 120, height: 80 };
  }
  ctx.font = TEXT_CLIP_FONT;
  return measureTextClipSourceSize(ctx, measureText, canvasSize);
}

export function resolvePlaceholderClipSourceSize(
  ctx: CanvasRenderingContext2D,
  clip: StudioClipResponse,
  canvasSize: CanvasSize,
  previewTextPlaceholder: string,
  draftText?: string | null
): SourceSize {
  return measurePlaceholderClipSource(ctx, clip, canvasSize, {
    previewTextPlaceholder,
    draftText,
  });
}

export interface ResolveClipSourceSizeOptions {
  measureCtx?: CanvasRenderingContext2D;
  previewTextPlaceholder?: string;
  draftText?: string | null;
}

export function resolveClipSourceSize(
  clip: StudioClipResponse,
  canvasSize: CanvasSize,
  sources: ClipMediaSources,
  options?: ResolveClipSourceSizeOptions
): SourceSize | null {
  if (isPlaceholderClip(clip)) {
    if (options?.measureCtx && options.previewTextPlaceholder !== undefined) {
      return measurePlaceholderClipSource(options.measureCtx, clip, canvasSize, {
        previewTextPlaceholder: options.previewTextPlaceholder,
        draftText: options.draftText,
      });
    }
    return null;
  }

  if (clip.media_type === "video" && clip.media_url) {
    const video = sources.getVideoElement?.(clip);
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      return { width: video.videoWidth, height: video.videoHeight };
    }
    return clipFallbackSourceSize(clip, canvasSize);
  }

  if (clip.media_type === "image" && clip.media_url) {
    const img = sources.getImageElement?.(clip.media_url);
    if (img?.complete && img.naturalWidth > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    return clipFallbackSourceSize(clip, canvasSize);
  }

  return null;
}

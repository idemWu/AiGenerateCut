"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  updateStudioClip,
  type StudioClipResponse,
  type StudioTimelineTrackResponse,
} from "@/lib/api/studio";
import type { CanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import {
  canvasToScreen,
  computeMediaDrawRect,
  getCanvasDisplayRect,
  hitTestCanvasPointInRect,
  normalizeTransform,
  readClipTransform,
  measurePlaceholderClipSource,
  resolveClipSourceSize,
  screenToCanvas,
  transformToApiRecord,
  type StudioClipTransform,
} from "@/lib/studio/composition/clipTransform";
import { isPlaceholderClip } from "@/lib/studio/studioClipUtils";
import {
  isClipActiveAtTime,
  resolveClipsAtTime,
} from "@/lib/studio/playback/resolveClipsAtTime";
import { useStudioEditorStore } from "@/lib/stores/studioEditorStore";

type DragMode = "move" | "scale" | "rotate";

interface DragState {
  mode: DragMode;
  pointerId: number;
  startPointer: { x: number; y: number };
  startTransform: StudioClipTransform;
  startCenter: { x: number; y: number };
  startDist: number;
  startAngle: number;
}

interface PendingTextMove {
  pointerId: number;
  startPointer: { x: number; y: number };
  startTransform: StudioClipTransform;
  startCenter: { x: number; y: number };
  startDist: number;
  startAngle: number;
}

const TEXT_DOUBLE_TAP_MS = 350;
const POINTER_DRAG_THRESHOLD = 5;

function transformsNearlyEqual(a: StudioClipTransform, b: StudioClipTransform): boolean {
  const eps = 0.001;
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.scale - b.scale) < eps &&
    Math.abs(a.rotation - b.rotation) < eps
  );
}

interface StudioClipTransformOverlayProps {
  projectId: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasSize: CanvasSize;
  tracks: StudioTimelineTrackResponse[];
  playheadSec: number;
  selectedClip: StudioClipResponse | null;
  isPlaying: boolean;
  draftTransform: StudioClipTransform | null;
  onDraftChange: (transform: StudioClipTransform | null) => void;
  getVideoElement: (clip: StudioClipResponse) => HTMLVideoElement | undefined;
  getImageElement: (url: string) => HTMLImageElement | undefined;
  requireLogin: (action: () => void) => void;
  onTracksMutate: () => Promise<unknown>;
  setSelectedClipId: (id: number | null) => void;
  textEditing?: boolean;
  previewTextPlaceholder?: string;
  draftText?: string | null;
  onTextClipDoubleClick?: () => void;
}

const CORNERS: { id: string; x: string; y: string; cursor: string }[] = [
  { id: "tl", x: "0%", y: "0%", cursor: "nwse-resize" },
  { id: "tr", x: "100%", y: "0%", cursor: "nesw-resize" },
  { id: "br", x: "100%", y: "100%", cursor: "nwse-resize" },
  { id: "bl", x: "0%", y: "100%", cursor: "nesw-resize" },
];

function findTrackForClip(
  tracks: StudioTimelineTrackResponse[],
  clipId: number
): StudioTimelineTrackResponse | null {
  for (const track of tracks) {
    if ((track.clips ?? []).some((c) => c.id === clipId)) return track;
  }
  return null;
}

export function isClipTransformable(clip: StudioClipResponse): boolean {
  if (clip.status !== "active") return false;
  if (clip.media_type === "video" || clip.media_type === "image") {
    return Boolean(clip.media_url);
  }
  return isPlaceholderClip(clip);
}

function angleFromCenter(center: { x: number; y: number }, point: { x: number; y: number }): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function StudioClipTransformOverlay({
  projectId,
  canvasRef,
  canvasSize,
  tracks,
  playheadSec,
  selectedClip,
  isPlaying,
  draftTransform,
  onDraftChange,
  getVideoElement,
  getImageElement,
  requireLogin,
  onTracksMutate,
  setSelectedClipId,
  textEditing = false,
  previewTextPlaceholder,
  draftText = null,
  onTextClipDoubleClick,
}: StudioClipTransformOverlayProps) {
  const { t } = useLanguage();
  const pausePlayback = useStudioEditorStore((s) => s.pausePlayback);
  const dragRef = useRef<DragState | null>(null);
  const pendingTextMoveRef = useRef<PendingTextMove | null>(null);
  const lastTextTapUpRef = useRef(0);
  const draftRef = useRef<StudioClipTransform | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [displayKey, setDisplayKey] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    setCanvasElement(canvas);
    if (!canvas) return;
    const bump = () => setDisplayKey((k) => k + 1);
    bump();
    const ro = new ResizeObserver(bump);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, selectedClip?.id]);

  const displayRect = useMemo(() => {
    if (!canvasElement) return null;
    void displayKey;
    return getCanvasDisplayRect(canvasElement.getBoundingClientRect(), canvasSize);
  }, [canvasElement, canvasSize, displayKey]);

  const effectiveTransform = useMemo(() => {
    if (!selectedClip) return null;
    return draftTransform ?? readClipTransform(selectedClip);
  }, [draftTransform, selectedClip]);

  const mediaRect = useMemo(() => {
    if (!selectedClip || !effectiveTransform || !displayRect) return null;
    const measureCtx = canvasElement?.getContext("2d");
    if (!measureCtx) return null;

    const sourceSize = isPlaceholderClip(selectedClip)
      ? previewTextPlaceholder !== undefined
        ? measurePlaceholderClipSource(measureCtx, selectedClip, canvasSize, {
            previewTextPlaceholder,
            draftText,
          })
        : null
      : resolveClipSourceSize(selectedClip, canvasSize, {
          getVideoElement,
          getImageElement,
        });
    if (!sourceSize) return null;
    return computeMediaDrawRect(canvasSize, sourceSize, effectiveTransform);
  }, [
    selectedClip,
    effectiveTransform,
    displayRect,
    canvasSize,
    canvasElement,
    getVideoElement,
    getImageElement,
    previewTextPlaceholder,
    draftText,
  ]);

  const track = useMemo(
    () => (selectedClip ? findTrackForClip(tracks, selectedClip.id) : null),
    [tracks, selectedClip]
  );

  const canEdit =
    !textEditing &&
    !isPlaying &&
    selectedClip != null &&
    isClipActiveAtTime(selectedClip, playheadSec) &&
    isClipTransformable(selectedClip) &&
    track != null &&
    !track.is_locked &&
    mediaRect != null &&
    mediaRect.width > 0;

  const screenBox = useMemo(() => {
    if (!mediaRect || !displayRect) return null;
    const center = canvasToScreen(
      { x: mediaRect.centerX, y: mediaRect.centerY },
      displayRect,
      canvasSize
    );
    const tl = canvasToScreen({ x: mediaRect.x, y: mediaRect.y }, displayRect, canvasSize);
    const br = canvasToScreen(
      { x: mediaRect.x + mediaRect.width, y: mediaRect.y + mediaRect.height },
      displayRect,
      canvasSize
    );
    return {
      width: Math.max(br.x - tl.x, 1),
      height: Math.max(br.y - tl.y, 1),
      centerX: center.x,
      centerY: center.y,
      rotation: mediaRect.rotation,
    };
  }, [mediaRect, displayRect, canvasSize]);

  const pickTopClipAtCanvasPoint = useCallback(
    (canvasPoint: { x: number; y: number }): number | null => {
      const measureCtx = canvasRef.current?.getContext("2d");
      const layers = resolveClipsAtTime(tracks, playheadSec);
      for (let i = layers.length - 1; i >= 0; i--) {
        const { clip } = layers[i]!;
        if (!isClipTransformable(clip)) continue;
        const sourceSize =
          isPlaceholderClip(clip) && measureCtx && previewTextPlaceholder !== undefined
            ? measurePlaceholderClipSource(measureCtx, clip, canvasSize, {
                previewTextPlaceholder,
                draftText: clip.id === selectedClip?.id ? draftText : null,
              })
            : resolveClipSourceSize(clip, canvasSize, {
                getVideoElement,
                getImageElement,
              });
        if (!sourceSize) continue;
        const rect = computeMediaDrawRect(canvasSize, sourceSize, readClipTransform(clip));
        if (hitTestCanvasPointInRect(canvasPoint, rect)) return clip.id;
      }
      return null;
    },
    [
      tracks,
      playheadSec,
      canvasSize,
      canvasRef,
      getVideoElement,
      getImageElement,
      previewTextPlaceholder,
      draftText,
      selectedClip?.id,
    ]
  );

  const pointerToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!displayRect) return null;
      return screenToCanvas({ x: clientX, y: clientY }, displayRect, canvasSize);
    },
    [displayRect, canvasSize]
  );

  const saveTransform = useCallback(
    (transform: StudioClipTransform) => {
      if (!selectedClip) return;
      requireLogin(() => {
        void (async () => {
          try {
            await updateStudioClip(projectId, selectedClip.id, {
              transform: transformToApiRecord(transform, selectedClip.transform),
            });
            await onTracksMutate();
            onDraftChange(null);
          } catch (e) {
            onDraftChange(null);
            toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
          }
        })();
      });
    },
    [selectedClip, requireLogin, projectId, onTracksMutate, onDraftChange, t]
  );

  const isPlaceholder =
    selectedClip != null && isPlaceholderClip(selectedClip);

  const beginDrag = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      mode: DragMode,
      canvasPoint: { x: number; y: number },
      center: { x: number; y: number }
    ) => {
      if (!effectiveTransform) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      dragRef.current = {
        mode,
        pointerId: e.pointerId,
        startPointer: canvasPoint,
        startTransform: { ...effectiveTransform },
        startCenter: { ...center },
        startDist: Math.max(dist(center, canvasPoint), 1),
        startAngle: angleFromCenter(center, canvasPoint) - effectiveTransform.rotation,
      };
      const initial = { ...effectiveTransform };
      draftRef.current = initial;
      if (!draftTransform) onDraftChange(initial);
    },
    [effectiveTransform, draftTransform, onDraftChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!displayRect) return;
      const canvasPoint = pointerToCanvas(e.clientX, e.clientY);
      if (!canvasPoint) return;

      if (!canEdit || !selectedClip || !mediaRect || !effectiveTransform) {
        const clipId = pickTopClipAtCanvasPoint(canvasPoint);
        if (clipId != null) {
          pausePlayback();
          setSelectedClipId(clipId);
        }
        return;
      }

      const target = e.target as HTMLElement;
      const handle = target.dataset.handle;
      const center = { x: mediaRect.centerX, y: mediaRect.centerY };
      const mode: DragMode =
        handle === "rotate" ? "rotate" : handle === "scale" ? "scale" : "move";

      if (
        isPlaceholder &&
        mode === "move" &&
        onTextClipDoubleClick &&
        handle !== "scale" &&
        handle !== "rotate"
      ) {
        const now = Date.now();
        if (now - lastTextTapUpRef.current < TEXT_DOUBLE_TAP_MS) {
          lastTextTapUpRef.current = 0;
          e.preventDefault();
          e.stopPropagation();
          pausePlayback();
          onTextClipDoubleClick();
          return;
        }
        pendingTextMoveRef.current = {
          pointerId: e.pointerId,
          startPointer: canvasPoint,
          startTransform: { ...effectiveTransform },
          startCenter: { ...center },
          startDist: Math.max(dist(center, canvasPoint), 1),
          startAngle: angleFromCenter(center, canvasPoint) - effectiveTransform.rotation,
        };
        return;
      }

      pausePlayback();
      beginDrag(e, mode, canvasPoint, center);
    },
    [
      displayRect,
      pointerToCanvas,
      canEdit,
      selectedClip,
      mediaRect,
      effectiveTransform,
      pickTopClipAtCanvasPoint,
      pausePlayback,
      setSelectedClipId,
      isPlaceholder,
      onTextClipDoubleClick,
      beginDrag,
    ]
  );

  const applyDragMove = useCallback(
    (drag: DragState, canvasPoint: { x: number; y: number }) => {
      const center = drag.startCenter;
      let next = { ...drag.startTransform };

      if (drag.mode === "move") {
        next = {
          ...next,
          x: drag.startTransform.x + (canvasPoint.x - drag.startPointer.x),
          y: drag.startTransform.y + (canvasPoint.y - drag.startPointer.y),
        };
      } else if (drag.mode === "scale") {
        const d = Math.max(dist(center, canvasPoint), 1);
        next = normalizeTransform({
          ...next,
          scale: drag.startTransform.scale * (d / drag.startDist),
        });
      } else if (drag.mode === "rotate") {
        next = {
          ...next,
          rotation: angleFromCenter(center, canvasPoint) - drag.startAngle,
        };
      }

      const normalized = normalizeTransform(next);
      draftRef.current = normalized;
      onDraftChange(normalized);
    },
    [onDraftChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const canvasPoint = pointerToCanvas(e.clientX, e.clientY);
      if (!canvasPoint) return;

      const pending = pendingTextMoveRef.current;
      if (pending && pending.pointerId === e.pointerId && !dragRef.current) {
        if (dist(canvasPoint, pending.startPointer) < POINTER_DRAG_THRESHOLD) return;

        pendingTextMoveRef.current = null;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          mode: "move",
          pointerId: e.pointerId,
          startPointer: pending.startPointer,
          startTransform: pending.startTransform,
          startCenter: pending.startCenter,
          startDist: pending.startDist,
          startAngle: pending.startAngle,
        };
        const initial = { ...pending.startTransform };
        draftRef.current = initial;
        if (!draftTransform) onDraftChange(initial);
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      applyDragMove(drag, canvasPoint);
    },
    [pointerToCanvas, applyDragMove, draftTransform, onDraftChange]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pendingTextMoveRef.current?.pointerId === e.pointerId) {
        pendingTextMoveRef.current = null;
        lastTextTapUpRef.current = Date.now();
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const toSave = draftRef.current;
      draftRef.current = null;
      if (!toSave || !selectedClip) return;

      const saved = readClipTransform(selectedClip);
      if (transformsNearlyEqual(toSave, saved)) {
        onDraftChange(null);
        return;
      }
      saveTransform(toSave);
    },
    [saveTransform, selectedClip, onDraftChange]
  );

  if (!displayRect) return null;

  const rotateHandleTop = "-44px";
  const showSelectionOutline =
    selectedClip != null && screenBox != null && !isPlaying;

  return (
    <>
      <MotionLayer
        displayRect={displayRect}
        canEdit={canEdit}
        showSelectionOutline={showSelectionOutline}
        screenBox={screenBox}
        rotateHandleTop={rotateHandleTop}
        rotateLabel={t("studioRotate")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTextClipEdit={
          isPlaceholder && canEdit && onTextClipDoubleClick
            ? () => {
                pendingTextMoveRef.current = null;
                onTextClipDoubleClick();
              }
            : undefined
        }
      />
      {isPlaying ? (
        <p
          className="pointer-events-none fixed z-30 rounded-md bg-black/70 px-2 py-1 text-[10px] text-muted-foreground"
          style={{
            left: displayRect.left + displayRect.width / 2,
            top: displayRect.top + displayRect.height + 6,
            transform: "translateX(-50%)",
          }}
        >
          {t("studioTransformHint")}
        </p>
      ) : null}
      {!isPlaying && track?.is_locked && selectedClip && isClipActiveAtTime(selectedClip, playheadSec) ? (
        <p
          className="pointer-events-none fixed z-30 rounded-md bg-black/70 px-2 py-1 text-[10px] text-muted-foreground"
          style={{
            left: displayRect.left + displayRect.width / 2,
            top: displayRect.top - 28,
            transform: "translateX(-50%)",
          }}
        >
          {t("studioTransformTrackLocked")}
        </p>
      ) : null}
    </>
  );
}

interface MotionLayerProps {
  displayRect: { left: number; top: number; width: number; height: number };
  canEdit: boolean;
  showSelectionOutline: boolean;
  screenBox: {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    rotation: number;
  } | null;
  rotateHandleTop: string;
  rotateLabel: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTextClipEdit?: () => void;
}

function MotionLayer({
  displayRect,
  canEdit,
  showSelectionOutline,
  screenBox,
  rotateHandleTop,
  rotateLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTextClipEdit,
}: MotionLayerProps) {
  const boxStyle = screenBox
    ? {
        left: screenBox.centerX - displayRect.left,
        top: screenBox.centerY - displayRect.top,
        width: screenBox.width,
        height: screenBox.height,
        transform: `translate(-50%, -50%) rotate(${screenBox.rotation}deg)`,
      }
    : undefined;

  return (
    <div
      className="fixed z-20 touch-none"
      style={{
        left: displayRect.left,
        top: displayRect.top,
        width: displayRect.width,
        height: displayRect.height,
        cursor: canEdit ? "default" : "pointer",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {canEdit && screenBox && boxStyle ? (
        <div className="pointer-events-none absolute border border-primary" style={boxStyle}>
          <div
            data-handle="move"
            className="pointer-events-auto absolute inset-0 cursor-move"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onTextClipEdit?.();
            }}
          />
          {CORNERS.map((corner) => (
            <button
              key={corner.id}
              type="button"
              data-handle="scale"
              aria-label={corner.id}
              className="pointer-events-auto absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-2 border-primary bg-background shadow-md"
              style={{ left: corner.x, top: corner.y, cursor: corner.cursor }}
            />
          ))}
          <button
            type="button"
            data-handle="rotate"
            aria-label={rotateLabel}
            className="pointer-events-auto absolute left-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-background shadow-md active:cursor-grabbing"
            style={{ top: rotateHandleTop }}
          />
        </div>
      ) : showSelectionOutline && screenBox && boxStyle ? (
        <div
          className="pointer-events-none absolute border border-dashed border-accent/50"
          style={boxStyle}
        />
      ) : null}
    </div>
  );
}

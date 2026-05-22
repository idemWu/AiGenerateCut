"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { updateStudioClip, type StudioClipResponse } from "@/lib/api/studio";
import type { CanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import {
  canvasToScreen,
  computeMediaDrawRect,
  getCanvasDisplayRect,
  readClipTransform,
  measurePlaceholderClipSource,
  type StudioClipTransform,
} from "@/lib/studio/composition/clipTransform";
import { isClipActiveAtTime } from "@/lib/studio/playback/resolveClipsAtTime";
import {
  getClipPreviewText,
  getClipTextContent,
  isPlaceholderClip,
} from "@/lib/studio/studioClipUtils";

interface ScreenLayout {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  lineHeight: number;
}

export interface StudioClipInlineTextEditHandle {
  startEditing: () => void;
}

interface StudioClipInlineTextEditProps {
  projectId: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasSize: CanvasSize;
  selectedClip: StudioClipResponse | null;
  playheadSec: number;
  isPlaying: boolean;
  draftTransform: StudioClipTransform | null;
  draftText: string | null;
  onDraftTextChange: (text: string | null) => void;
  onEditingChange: (editing: boolean) => void;
  requireLogin: (action: () => void) => void;
  onTracksMutate: () => Promise<unknown>;
}

function computeScreenLayout(
  canvas: HTMLCanvasElement,
  canvasSize: CanvasSize,
  clip: StudioClipResponse,
  transform: StudioClipTransform,
  measureText: string,
  emptyPreview: string
): ScreenLayout | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const display = getCanvasDisplayRect(canvas.getBoundingClientRect(), canvasSize);
  const clipForMeasure = { ...clip, text_content: measureText || null };
  const sourceSize = measurePlaceholderClipSource(ctx, clipForMeasure, canvasSize, {
    previewTextPlaceholder: emptyPreview,
    draftText: measureText,
  });
  const rect = computeMediaDrawRect(canvasSize, sourceSize, transform);
  const tl = canvasToScreen({ x: rect.x, y: rect.y }, display, canvasSize);
  const br = canvasToScreen(
    { x: rect.x + rect.width, y: rect.y + rect.height },
    display,
    canvasSize
  );
  const scale = display.width / canvasSize.width;

  return {
    centerX: (tl.x + br.x) / 2,
    centerY: (tl.y + br.y) / 2,
    width: Math.max(br.x - tl.x, 1),
    height: Math.max(br.y - tl.y, 1),
    rotation: rect.rotation,
    fontSize: Math.max(12, 48 * scale),
    lineHeight: Math.max(16, 56 * scale),
  };
}

const StudioClipInlineTextEdit = forwardRef<
  StudioClipInlineTextEditHandle,
  StudioClipInlineTextEditProps
>(function StudioClipInlineTextEdit(
  {
    projectId,
    canvasRef,
    canvasSize,
    selectedClip,
    playheadSec,
    isPlaying,
    draftTransform,
    draftText,
    onDraftTextChange,
    onEditingChange,
    requireLogin,
    onTracksMutate,
  },
  ref
) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const frozenLayoutRef = useRef<ScreenLayout | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayKey, setDisplayKey] = useState(0);

  useEffect(() => {
    setEditing(false);
    onEditingChange(false);
    onDraftTextChange(null);
    frozenLayoutRef.current = null;
  }, [selectedClip?.id, onEditingChange, onDraftTextChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => setDisplayKey((k) => k + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  const emptyPreview = t("studioTextClipEmptyPreview");

  const canInteract =
    !isPlaying &&
    selectedClip != null &&
    isPlaceholderClip(selectedClip) &&
    isClipActiveAtTime(selectedClip, playheadSec);

  const liveScreenLayout = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedClip || !canInteract) return null;
    void displayKey;
    const transform = draftTransform ?? readClipTransform(selectedClip);
    const measureText =
      draftText !== null
        ? draftText
        : getClipPreviewText(selectedClip, emptyPreview);
    return computeScreenLayout(
      canvas,
      canvasSize,
      selectedClip,
      transform,
      measureText,
      emptyPreview
    );
  }, [
    canvasRef,
    canvasSize,
    selectedClip,
    canInteract,
    displayKey,
    draftTransform,
    draftText,
    emptyPreview,
  ]);

  const activeLayout =
    editing && frozenLayoutRef.current ? frozenLayoutRef.current : liveScreenLayout;

  const startEditing = useCallback(() => {
    const canvas = canvasRef.current;
    if (!selectedClip || !canInteract || !canvas) return;

    const transform = draftTransform ?? readClipTransform(selectedClip);
    const measureText = getClipPreviewText(selectedClip, emptyPreview);
    frozenLayoutRef.current = computeScreenLayout(
      canvas,
      canvasSize,
      selectedClip,
      transform,
      measureText,
      emptyPreview
    );

    onDraftTextChange(getClipTextContent(selectedClip) ?? "");
    setEditing(true);
    onEditingChange(true);
  }, [
    canvasRef,
    selectedClip,
    canInteract,
    draftTransform,
    canvasSize,
    emptyPreview,
    onDraftTextChange,
    onEditingChange,
  ]);

  useImperativeHandle(ref, () => ({ startEditing }), [startEditing]);

  useEffect(() => {
    if (!editing) return;
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [editing]);

  const saveAndClose = useCallback(
    (value: string) => {
      if (!selectedClip) return;
      const trimmed = value.trim();
      requireLogin(() => {
        void (async () => {
          try {
            await updateStudioClip(projectId, selectedClip.id, {
              text_content: trimmed,
            });
            await onTracksMutate();
            onDraftTextChange(null);
            setEditing(false);
            onEditingChange(false);
            frozenLayoutRef.current = null;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
          }
        })();
      });
    },
    [
      selectedClip,
      requireLogin,
      projectId,
      onTracksMutate,
      onDraftTextChange,
      onEditingChange,
      t,
    ]
  );

  const handleBlur = useCallback(() => {
    if (!editing || !selectedClip) return;
    saveAndClose(draftText ?? "");
  }, [editing, selectedClip, draftText, saveAndClose]);

  if (!canInteract || !activeLayout || !editing) return null;

  const displayValue = draftText ?? getClipTextContent(selectedClip!) ?? "";

  return (
    <div
      className="fixed z-30 box-border flex cursor-text items-center justify-center border-2 border-primary bg-black/80"
        style={{
          left: activeLayout.centerX,
          top: activeLayout.centerY,
          width: activeLayout.width,
          height: activeLayout.height,
          transform: `translate(-50%, -50%) rotate(${activeLayout.rotation}deg)`,
        }}
      >
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => onDraftTextChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDraftTextChange(null);
              setEditing(false);
              onEditingChange(false);
              frozenLayoutRef.current = null;
            }
          }}
          rows={1}
          className="m-0 max-h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center font-semibold text-white outline-none"
          style={{
            fontSize: activeLayout.fontSize,
            lineHeight: `${activeLayout.lineHeight}px`,
            fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif",
          }}
        />
    </div>
  );
});

export default StudioClipInlineTextEdit;

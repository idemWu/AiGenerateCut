"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import {
  hasOverlapOnTrack,
  hasOverlapOnTrackExcluding,
  snapClipStart,
} from "@/lib/studio/timeline/clipSnap";
import { trackRowStride } from "./timelineLayout";

export interface ClipDragPreviewItem {
  clipId: number;
  trackId: number;
  startSec: number;
  hasConflict: boolean;
}

export interface ClipDragPreview {
  clipId: number;
  trackId: number;
  startSec: number;
  hasConflict: boolean;
  groupItems?: ClipDragPreviewItem[];
}

export interface ClipDragOrigin {
  trackId: number;
  startSec: number;
}

interface UseClipDragOptions {
  tracks: StudioTimelineTrackResponse[];
  pxPerSec: number;
  trackRowHeight: number;
  trackGap: number;
  rulerHeight: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onClipSelect: (clipId: number, startSec: number) => void;
  onCommit: (clipId: number, trackId: number, startSec: number) => Promise<void>;
  selectedClipIds?: number[];
  onSelectionChange?: (clipIds: number[]) => void;
  onGroupCommit?: (items: ClipDragPreviewItem[]) => Promise<void>;
}

export function useClipDrag({
  tracks,
  pxPerSec,
  trackRowHeight,
  trackGap,
  rulerHeight,
  scrollRef,
  canvasRef,
  onClipSelect,
  onCommit,
  selectedClipIds = [],
  onSelectionChange,
  onGroupCommit,
}: UseClipDragOptions) {
  const [preview, setPreview] = useState<ClipDragPreview | null>(null);
  const [draggingClip, setDraggingClip] = useState<StudioClipResponse | null>(null);
  const [origin, setOrigin] = useState<ClipDragOrigin | null>(null);
  const previewRef = useRef<ClipDragPreview | null>(null);
  const dragRef = useRef<{
    clip: StudioClipResponse;
    clipId: number;
    originTrackId: number;
    originStartSec: number;
    pointerX: number;
    pointerY: number;
    dragItems: {
      clip: StudioClipResponse;
      originTrackId: number;
      originStartSec: number;
    }[];
  } | null>(null);
  const tracksRef = useRef(tracks);

  const rowStride = trackRowHeight + trackGap;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const setPreviewState = useCallback((next: ClipDragPreview | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const resolveTrackIndexFromY = useCallback(
    (clientY: number): number => {
      const canvas = canvasRef.current;
      const list = tracksRef.current;
      if (!canvas || list.length === 0) return 0;
      const rect = canvas.getBoundingClientRect();
      const yInCanvas = clientY - rect.top - rulerHeight;
      const idx = Math.floor(yInCanvas / rowStride);
      return Math.max(0, Math.min(list.length - 1, idx));
    },
    [canvasRef, rulerHeight, rowStride]
  );

  const computePreview = useCallback(
    (clipId: number, trackId: number, startSec: number): ClipDragPreview => {
      const track = tracksRef.current.find((t) => t.id === trackId);
      const clip = tracksRef.current.flatMap((t) => t.clips ?? []).find((c) => c.id === clipId);
      let hasConflict = false;
      if (track && clip) {
        const start = Math.max(0, startSec);
        hasConflict = hasOverlapOnTrack(track, clipId, start, clip.duration_sec);
      }
      return { clipId, trackId, startSec: Math.max(0, startSec), hasConflict };
    },
    []
  );

  const computeGroupPreview = useCallback(
    (
      primaryClipId: number,
      primaryTrackId: number,
      primaryStartSec: number,
      items: {
        clip: StudioClipResponse;
        originTrackId: number;
        originStartSec: number;
      }[]
    ): ClipDragPreview => {
      const primary = items.find((item) => item.clip.id === primaryClipId);
      const deltaSec = primary ? primaryStartSec - primary.originStartSec : 0;
      const excludedClipIds = new Set(items.map((item) => item.clip.id));

      const groupItems = items.map<ClipDragPreviewItem>((item) => {
        const track = tracksRef.current.find((t) => t.id === item.originTrackId);
        const startSec = item.originStartSec + deltaSec;
        const hasConflict =
          startSec < 0 ||
          track == null ||
          track.is_locked ||
          hasOverlapOnTrackExcluding(
            track,
            excludedClipIds,
            startSec,
            item.clip.duration_sec
          );
        return {
          clipId: item.clip.id,
          trackId: item.originTrackId,
          startSec: Math.max(0, startSec),
          hasConflict,
        };
      });

      return {
        clipId: primaryClipId,
        trackId: primaryTrackId,
        startSec: Math.max(0, primaryStartSec),
        hasConflict: groupItems.some((item) => item.hasConflict),
        groupItems,
      };
    },
    []
  );

  const updateDragFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const scroll = scrollRef.current;
      const canvas = canvasRef.current;
      if (!scroll || !canvas) return;

      const deltaX = clientX - drag.pointerX;
      const deltaSec = deltaX / pxPerSec;
      const rawStart = drag.originStartSec + deltaSec;

      if (drag.dragItems.length > 1) {
        const minStart = Math.min(...drag.dragItems.map((item) => item.originStartSec));
        const clampedDelta = Math.max(deltaSec, -minStart);
        setPreviewState(
          computeGroupPreview(
            drag.clipId,
            drag.originTrackId,
            drag.originStartSec + clampedDelta,
            drag.dragItems
          )
        );
        return;
      }

      const trackIdx = resolveTrackIndexFromY(clientY);
      const targetTrack = tracksRef.current[trackIdx];
      const originTrack = tracksRef.current.find((t) => t.id === drag.originTrackId);

      if (!targetTrack || targetTrack.is_locked) {
        const snapped =
          originTrack != null
            ? snapClipStart(
                originTrack,
                drag.clipId,
                rawStart,
                drag.clip.duration_sec,
                pxPerSec
              )
            : rawStart;
        setPreviewState(computePreview(drag.clipId, drag.originTrackId, snapped));
        return;
      }

      const snapped = snapClipStart(
        targetTrack,
        drag.clipId,
        rawStart,
        drag.clip.duration_sec,
        pxPerSec
      );
      setPreviewState(computePreview(drag.clipId, targetTrack.id, snapped));
    },
    [
      canvasRef,
      computeGroupPreview,
      computePreview,
      pxPerSec,
      resolveTrackIndexFromY,
      scrollRef,
      setPreviewState,
    ]
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;

    const current = previewRef.current;
    if (drag && current && !current.hasConflict) {
      if (current.groupItems && current.groupItems.length > 1 && onGroupCommit) {
        void onGroupCommit(current.groupItems);
      } else {
        void onCommit(current.clipId, current.trackId, current.startSec);
      }
    }

    setDraggingClip(null);
    setOrigin(null);
    setPreviewState(null);
  }, [onCommit, onGroupCommit, setPreviewState]);

  useEffect(() => {
    if (!preview) return;

    const onMove = (e: PointerEvent) => {
      updateDragFromPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      endDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [preview, updateDragFromPointer, endDrag]);

  const handleClipPointerDown = useCallback(
    (e: React.PointerEvent, clip: StudioClipResponse, trackId: number) => {
      if (e.button !== 0) return;

      const track = tracksRef.current.find((t) => t.id === trackId);
      if (track?.is_locked) return;

      e.stopPropagation();
      e.preventDefault();

      const selectedSet = new Set(selectedClipIds);
      const shouldDragSelection = selectedSet.has(clip.id) && selectedSet.size > 1;
      if (!shouldDragSelection) {
        onClipSelect(clip.id, clip.start_sec);
        onSelectionChange?.([clip.id]);
      }

      const dragOrigin: ClipDragOrigin = { trackId, startSec: clip.start_sec };
      setOrigin(dragOrigin);
      setDraggingClip(clip);
      const dragItems = shouldDragSelection
        ? tracksRef.current
            .flatMap((item) => item.clips ?? [])
            .filter((item) => selectedSet.has(item.id))
            .map((item) => ({
              clip: item,
              originTrackId:
                tracksRef.current.find((trackItem) =>
                  (trackItem.clips ?? []).some((candidate) => candidate.id === item.id)
                )?.id ?? trackId,
              originStartSec: item.start_sec,
            }))
        : [{ clip, originTrackId: trackId, originStartSec: clip.start_sec }];

      dragRef.current = {
        clip,
        clipId: clip.id,
        originTrackId: trackId,
        originStartSec: clip.start_sec,
        pointerX: e.clientX,
        pointerY: e.clientY,
        dragItems,
      };
      setPreviewState(
        dragItems.length > 1
          ? computeGroupPreview(clip.id, trackId, clip.start_sec, dragItems)
          : computePreview(clip.id, trackId, clip.start_sec)
      );
    },
    [
      computeGroupPreview,
      computePreview,
      onClipSelect,
      onSelectionChange,
      selectedClipIds,
      setPreviewState,
    ]
  );

  const getClipStyle = useCallback(
    (clip: StudioClipResponse, trackId: number) => {
      const groupItem = preview?.groupItems?.find(
        (item) => item.clipId === clip.id && item.trackId === trackId
      );
      if (groupItem) {
        return {
          left: groupItem.startSec * pxPerSec,
          width: Math.max(24, clip.duration_sec * pxPerSec),
          trackId,
          conflict: preview?.hasConflict ?? groupItem.hasConflict,
          isDragging: true,
          isPlaceholder: false,
        };
      }

      const isDragging = preview?.clipId === clip.id;
      const onTargetTrack = isDragging && preview.trackId === trackId;

      if (onTargetTrack) {
        return {
          left: preview.startSec * pxPerSec,
          width: Math.max(24, clip.duration_sec * pxPerSec),
          trackId: preview.trackId,
          conflict: preview.hasConflict,
          isDragging: true,
          isPlaceholder: false,
        };
      }

      return {
        left: clip.start_sec * pxPerSec,
        width: Math.max(24, clip.duration_sec * pxPerSec),
        trackId,
        conflict: false,
        isDragging: isDragging && preview.trackId !== trackId,
        isPlaceholder: isDragging && preview.trackId !== trackId,
      };
    },
    [preview, pxPerSec]
  );

  const getTargetTrackIndex = useCallback((): number | null => {
    if (!preview) return null;
    const idx = tracksRef.current.findIndex((t) => t.id === preview.trackId);
    return idx >= 0 ? idx : null;
  }, [preview]);

  return {
    preview,
    origin,
    draggingClip,
    handleClipPointerDown,
    getClipStyle,
    getTargetTrackIndex,
    isDragging: preview != null,
    trackRowStride: trackRowStride(),
  };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  createStudioClip,
  createStudioTrack,
  deleteStudioClip,
  deleteStudioTrack,
  updateStudioClip,
  type CreateStudioClipRequest,
  type StudioClipResponse,
  type StudioTimelineTrackResponse,
  type StudioUpdateClipRequest,
} from "@/lib/api/studio";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StudioTimelineToolbar from "./StudioTimelineToolbar";
import StudioTrackLabelColumn from "./StudioTrackLabelColumn";
import StudioClipContextMenu from "./StudioClipContextMenu";
import StudioClipRenameDialog from "./StudioClipRenameDialog";
import { uploadStudioClipAtPlayhead } from "@/lib/studio/uploadStudioClip";
import { createLocalAssetClip } from "@/lib/studio/localAssets/createLocalAssetClip";
import { getLocalMediaAsset } from "@/lib/studio/localAssets/localAssetsApi";
import {
  parseLocalAssetDragData,
  STUDIO_LOCAL_ASSET_DRAG_MIME,
} from "@/lib/studio/localAssets/localAssetDrag";
import { parseLocalAssetObjectKey } from "@/lib/studio/localAssets/localAssetUrl";
import { useStudioEditorStore } from "@/lib/stores/studioEditorStore";
import type { PlayheadSubscriber } from "@/lib/studio/playback/useStudioPlayback";
import type { components } from "@/lib/api/schema";
import {
  buildMajorRulerBands,
  buildTimeRulerTicks,
  getRulerSteps,
  type TimeRulerTick,
} from "./timeRuler";
import { pointerToSec } from "./pointerToSec";
import { useClipDrag, type ClipDragPreviewItem } from "./useClipDrag";
import {
  RULER_HEIGHT,
  TRACK_GAP,
  TRACK_LABEL_WIDTH,
  TRACK_ROW_HEIGHT,
  trackAreaTop,
  trackRowStride,
} from "./timelineLayout";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];
type StudioClipMediaType = components["schemas"]["StudioClipMediaType"];

const MIN_SPLIT_SEGMENT_SEC = 0.1;

interface ClipSplitInfo {
  sec: number;
  leftDurationSec: number;
  rightDurationSec: number;
}

interface SplitTarget {
  clip: StudioClipResponse;
  trackId: number;
  splitInfo: ClipSplitInfo;
}

type ClipEditOperation = "trimLeft" | "split" | "trimRight";

interface StudioTimelineProps {
  projectId: number;
  aspectRatio: StudioAspectRatio;
  tracks: StudioTimelineTrackResponse[];
  /** 标尺宽度、拖放 clamp 用 */
  durationSec: number;
  /** UI「/」右侧：最后一个 clip 结束时间 */
  contentEndSec: number;
  playheadSec: number;
  playheadRef: React.MutableRefObject<number>;
  subscribePlayhead: (fn: PlayheadSubscriber) => () => void;
  timelineZoom: number;
  isPlaying: boolean;
  collapsed: boolean;
  selectedClipId: number | null;
  onPlayheadChange: (sec: number) => void;
  onClipSelect: (clipId: number, startSec: number) => void;
  onClearClipSelection: () => void;
  onTogglePlay: () => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
  onZoomChange: (zoom: number) => void;
  onCollapse: () => void;
  onExpand: () => void;
  onClipOptimisticMove?: (clipId: number, trackId: number, startSec: number) => Promise<unknown>;
  onTracksMutate: () => Promise<unknown>;
  onWorkflowsMutate: () => Promise<unknown>;
  onClipCreated?: (clipId: number, workflowId: number, startSec: number) => void;
  capturingKeyframe: boolean;
  onCaptureKeyframe: () => void;
  requireLogin: (action: () => void) => void;
}

export default function StudioTimeline({
  projectId,
  aspectRatio,
  tracks,
  durationSec,
  contentEndSec,
  playheadSec,
  playheadRef,
  subscribePlayhead,
  timelineZoom,
  isPlaying,
  collapsed,
  selectedClipId,
  onPlayheadChange,
  onClipSelect,
  onClearClipSelection,
  onTogglePlay,
  onSkipToStart,
  onSkipToEnd,
  onZoomChange,
  onCollapse,
  onExpand,
  onClipOptimisticMove,
  onTracksMutate,
  onWorkflowsMutate,
  onClipCreated,
  capturingKeyframe,
  onCaptureKeyframe,
  requireLogin,
}: StudioTimelineProps) {
  const { t } = useLanguage();
  const pausePlayback = useStudioEditorStore((s) => s.pausePlayback);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playheadDivRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState(false);
  const [confirmDeleteTrackOpen, setConfirmDeleteTrackOpen] = useState(false);
  const [clipContextMenu, setClipContextMenu] = useState<{
    clip: StudioClipResponse;
    x: number;
    y: number;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<StudioClipResponse | null>(null);
  const [deleteClipTarget, setDeleteClipTarget] = useState<StudioClipResponse | null>(null);
  const [renamingClip, setRenamingClip] = useState(false);
  const [deletingClip, setDeletingClip] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<number[]>([]);
  const [activeClipEditOperation, setActiveClipEditOperation] =
    useState<ClipEditOperation | null>(null);
  const [missingLocalClipIds, setMissingLocalClipIds] = useState<Set<number>>(() => new Set());
  const dragPlayheadRef = useRef(false);
  const scrubbingRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  const pxPerSec = timelineZoom;
  const contentWidth = durationSec * pxPerSec;
  const layoutWidth = Math.max(viewportWidth, contentWidth);

  const rulerSteps = useMemo(() => getRulerSteps(pxPerSec), [pxPerSec]);
  const ticks = useMemo(
    () => buildTimeRulerTicks(durationSec, pxPerSec, layoutWidth),
    [durationSec, pxPerSec, layoutWidth]
  );
  const rulerBands = useMemo(
    () => buildMajorRulerBands(durationSec, pxPerSec, layoutWidth),
    [durationSec, pxPerSec, layoutWidth]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setViewportWidth(w);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.sort_order - b.sort_order),
    [tracks]
  );
  const selectedClip = useMemo(() => {
    if (selectedClipId == null) return null;

    for (const track of sortedTracks) {
      const clip = (track.clips ?? []).find((item) => item.id === selectedClipId);
      if (clip) return clip;
    }

    return null;
  }, [selectedClipId, sortedTracks]);

  const allTimelineClips = useMemo(
    () => sortedTracks.flatMap((track) => track.clips ?? []),
    [sortedTracks]
  );

  const selectedClipIdSet = useMemo(() => new Set(selectedClipIds), [selectedClipIds]);

  useEffect(() => {
    const localClips = allTimelineClips
      .map((clip) => ({ clip, assetId: parseLocalAssetObjectKey(clip.media_url) }))
      .filter((item): item is { clip: StudioClipResponse; assetId: string } => !!item.assetId);

    if (localClips.length === 0) {
      setMissingLocalClipIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    let cancelled = false;
    void (async () => {
      const missingIds = await Promise.all(
        localClips.map(async ({ clip, assetId }) => {
          try {
            const asset = await getLocalMediaAsset(projectId, assetId);
            return asset?.exists ? null : clip.id;
          } catch {
            return clip.id;
          }
        })
      );
      if (!cancelled) {
        setMissingLocalClipIds(new Set(missingIds.filter((id): id is number => id != null)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allTimelineClips, projectId]);

  const selectedClips = useMemo(
    () => allTimelineClips.filter((clip) => selectedClipIdSet.has(clip.id)),
    [allTimelineClips, selectedClipIdSet]
  );

  const directionalSelection = useMemo(() => {
    const left: number[] = [];
    const right: number[] = [];
    const eps = 0.001;

    for (const track of sortedTracks) {
      if (track.is_locked) continue;
      for (const clip of track.clips ?? []) {
        const startsBeforePlayhead = clip.start_sec <= playheadSec + eps;
        const endsAfterPlayhead = clip.end_sec >= playheadSec - eps;

        if (startsBeforePlayhead) {
          left.push(clip.id);
        }
        if (endsAfterPlayhead) {
          right.push(clip.id);
        }
      }
    }

    return { left, right };
  }, [playheadSec, sortedTracks]);

  const splitTargetAtPlayhead = useMemo(
    () =>
      findSplitTargetAtSec({
        selectedClipIds,
        sortedTracks,
        sec: playheadSec,
      }),
    [playheadSec, selectedClipIds, sortedTracks]
  );

  useEffect(() => {
    if (selectedClipId == null) return;
    setSelectedClipIds((prev) =>
      prev.length === 1 && prev[0] === selectedClipId ? prev : [selectedClipId]
    );
  }, [selectedClipId]);

  useEffect(() => {
    const knownClipIds = new Set(allTimelineClips.map((clip) => clip.id));
    setSelectedClipIds((prev) => prev.filter((id) => knownClipIds.has(id)));
  }, [allTimelineClips]);

  useEffect(() => {
    if (isPlaying) setSelectedClipIds([]);
  }, [isPlaying]);

  const handleClipCommit = useCallback(
    async (clipId: number, trackId: number, startSec: number) => {
      pausePlayback();
      try {
        await onClipOptimisticMove?.(clipId, trackId, startSec);
        await updateStudioClip(projectId, clipId, {
          track_id: trackId,
          start_sec: startSec,
        });
        await onTracksMutate();
      } catch (err) {
        try {
          await onTracksMutate();
        } catch {
          // Keep the original update error visible if rollback refresh also fails.
        }
        const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
        toast.error(msg);
      }
    },
    [onClipOptimisticMove, onTracksMutate, pausePlayback, projectId, t]
  );

  const handleClipGroupCommit = useCallback(
    async (items: ClipDragPreviewItem[]) => {
      pausePlayback();
      try {
        await Promise.all(
          items.map((item) =>
            updateStudioClip(projectId, item.clipId, {
              track_id: item.trackId,
              start_sec: item.startSec,
            })
          )
        );
        await onTracksMutate();
        setSelectedClipIds(items.map((item) => item.clipId));
      } catch (err) {
        try {
          await onTracksMutate();
        } catch {
          // Keep the original update error visible if rollback refresh also fails.
        }
        const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
        toast.error(msg);
      }
    },
    [onTracksMutate, pausePlayback, projectId, t]
  );

  const {
    preview: dragPreview,
    origin: dragOrigin,
    draggingClip,
    handleClipPointerDown,
    getClipStyle,
    getTargetTrackIndex,
    isDragging,
  } = useClipDrag({
    tracks: sortedTracks,
    pxPerSec,
    trackRowHeight: TRACK_ROW_HEIGHT,
    trackGap: TRACK_GAP,
    rulerHeight: RULER_HEIGHT,
    scrollRef,
    canvasRef,
    onClipSelect,
    onCommit: handleClipCommit,
    selectedClipIds,
    onSelectionChange: setSelectedClipIds,
    onGroupCommit: handleClipGroupCommit,
  });

  const targetTrackIndex = getTargetTrackIndex();

  const resolveSecFromEvent = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      const scroll = scrollRef.current;
      if (!canvas || !scroll) return playheadRef.current;
      const rect = canvas.getBoundingClientRect();
      return pointerToSec({
        clientX,
        canvasLeft: rect.left,
        scrollLeft: scroll.scrollLeft,
        pxPerSec,
        durationSec,
      });
    },
    [durationSec, playheadRef, pxPerSec]
  );

  const resolveTrackFromEvent = useCallback(
    (clientY: number): StudioTimelineTrackResponse | null => {
      const canvas = canvasRef.current;
      if (!canvas || sortedTracks.length === 0) return null;
      const rect = canvas.getBoundingClientRect();
      const yInTrackArea = clientY - rect.top - RULER_HEIGHT;
      const trackIndex = Math.max(
        0,
        Math.min(sortedTracks.length - 1, Math.floor(yInTrackArea / trackRowStride()))
      );
      return sortedTracks[trackIndex] ?? null;
    },
    [sortedTracks]
  );

  // 播放头 DOM + 自动滚动均由 subscribePlayhead 直接写入，零 React 渲染
  useEffect(() => {
    const div = playheadDivRef.current;
    if (div) div.style.left = `${playheadRef.current * pxPerSec}px`;
    const apply = (sec: number) => {
      const node = playheadDivRef.current;
      if (node) node.style.left = `${sec * pxPerSec}px`;
      if (!isPlaying) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const x = sec * pxPerSec;
      const margin = 48;
      if (
        x < scroll.scrollLeft + margin ||
        x > scroll.scrollLeft + scroll.clientWidth - margin
      ) {
        scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 3);
      }
    };
    const unsub = subscribePlayhead(apply);
    return () => {
      unsub();
    };
  }, [isPlaying, playheadRef, pxPerSec, subscribePlayhead]);

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-clip-block]")) return;
      if (e.button !== 0) return;
      pausePlayback();
      setClipContextMenu(null);
      setSelectedTrackId(null);
      setSelectedClipIds([]);
      scrubbingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      onPlayheadChange(resolveSecFromEvent(e.clientX));
    },
    [onPlayheadChange, pausePlayback, resolveSecFromEvent]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      onPlayheadChange(resolveSecFromEvent(e.clientX));
    },
    [onPlayheadChange, resolveSecFromEvent]
  );

  const endCanvasScrub = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleSelectTrack = useCallback(
    (trackId: number) => {
      pausePlayback();
      setSelectedTrackId(trackId);
      setSelectedClipIds([]);
    },
    [pausePlayback]
  );

  const handleDeleteTrack = useCallback(() => {
    if (selectedTrackId == null) return;
    const track = sortedTracks.find((tr) => tr.id === selectedTrackId);
    if (!track) return;
    if (track.is_locked) {
      toast.error(t("studioTimelineDeleteTrackLocked"));
      return;
    }
    if ((track.clips ?? []).length > 0) {
      toast.error(t("studioTimelineDeleteTrackHasClips"));
      return;
    }
    requireLogin(() => {
      pausePlayback();
      setConfirmDeleteTrackOpen(true);
    });
  }, [pausePlayback, requireLogin, selectedTrackId, sortedTracks, t]);

  const handleConfirmDeleteTrack = useCallback(() => {
    if (selectedTrackId == null) return;
    const trackIdToDelete = selectedTrackId;
    requireLogin(() => {
      pausePlayback();
      void (async () => {
        setDeletingTrack(true);
        try {
          await deleteStudioTrack(projectId, trackIdToDelete);
          setConfirmDeleteTrackOpen(false);
          setSelectedTrackId(null);
          toast.success(t("studioTimelineDeleteTrackSuccess"));
          await onTracksMutate();
        } catch (err) {
          const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
          toast.error(msg);
        } finally {
          setDeletingTrack(false);
        }
      })();
    });
  }, [onTracksMutate, pausePlayback, projectId, requireLogin, selectedTrackId, t]);

  const handleClipContextMenu = useCallback(
    (e: React.MouseEvent, clip: StudioClipResponse) => {
      e.preventDefault();
      e.stopPropagation();
      pausePlayback();
      onClipSelect(clip.id, clip.start_sec);
      setSelectedClipIds([clip.id]);
      setClipContextMenu({ clip, x: e.clientX, y: e.clientY });
    },
    [onClipSelect, pausePlayback]
  );

  const handleConfirmRenameClip = useCallback(
    (title: string) => {
      if (!renameTarget) return;
      requireLogin(() => {
        pausePlayback();
        void (async () => {
          setRenamingClip(true);
          try {
            await updateStudioClip(projectId, renameTarget.id, {
              title: title.length > 0 ? title : null,
            });
            await onTracksMutate();
            setRenameTarget(null);
            toast.success(t("studioClipRenameSuccess"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
            toast.error(msg);
          } finally {
            setRenamingClip(false);
          }
        })();
      });
    },
    [onTracksMutate, pausePlayback, projectId, renameTarget, requireLogin, t]
  );

  const handleConfirmDeleteClip = useCallback(() => {
    const targetClips =
      selectedClips.length > 0 ? selectedClips : deleteClipTarget ? [deleteClipTarget] : [];
    if (targetClips.length === 0) return;
    const clipIds = targetClips.map((clip) => clip.id);
    requireLogin(() => {
      pausePlayback();
      void (async () => {
        setDeletingClip(true);
        try {
          await Promise.all(clipIds.map((clipId) => deleteStudioClip(projectId, clipId)));
          setDeleteClipTarget(null);
          setSelectedClipIds([]);
          if (selectedClipId != null && clipIds.includes(selectedClipId)) onClearClipSelection();
          toast.success(
            clipIds.length > 1
              ? t("studioTimelineDeleteSelectedClipsSuccess")
              : t("studioTimelineDeleteClipSuccess")
          );
          await onTracksMutate();
        } catch (err) {
          const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
          toast.error(msg);
        } finally {
          setDeletingClip(false);
        }
      })();
    });
  }, [
    deleteClipTarget,
    onClearClipSelection,
    onTracksMutate,
    pausePlayback,
    projectId,
    requireLogin,
    selectedClips,
    selectedClipId,
    t,
  ]);

  const handleRenameSelectedClip = useCallback(() => {
    const clip = selectedClips.length === 1 ? selectedClips[0] : selectedClip;
    if (!clip) return;
    pausePlayback();
    setRenameTarget(clip);
  }, [pausePlayback, selectedClip, selectedClips]);

  const handleDeleteSelectedClip = useCallback(() => {
    const targetClips =
      selectedClips.length > 0 ? selectedClips : selectedClip ? [selectedClip] : [];
    if (targetClips.length === 0) return;
    pausePlayback();
    setDeleteClipTarget(targetClips[0]!);
  }, [pausePlayback, selectedClip, selectedClips]);

  const handleSelectAllLeft = useCallback(() => {
    pausePlayback();
    setClipContextMenu(null);
    setSelectedTrackId(null);
    setSelectedClipIds(directionalSelection.left);
    onClearClipSelection();
  }, [directionalSelection.left, onClearClipSelection, pausePlayback]);

  const handleSelectAllRight = useCallback(() => {
    pausePlayback();
    setClipContextMenu(null);
    setSelectedTrackId(null);
    setSelectedClipIds(directionalSelection.right);
    onClearClipSelection();
  }, [directionalSelection.right, onClearClipSelection, pausePlayback]);

  const handleTrimClipAtPlayhead = useCallback(
    (direction: "left" | "right") => {
      if (activeClipEditOperation != null) return;
      if (!splitTargetAtPlayhead) {
        toast.error(t("studioTimelineCutTooClose"));
        return;
      }

      const { clip, splitInfo } = splitTargetAtPlayhead;
      const updateRequest = buildTrimClipUpdateRequest(clip, splitInfo, direction);
      const operation: ClipEditOperation = direction === "left" ? "trimLeft" : "trimRight";

      requireLogin(() => {
        pausePlayback();
        setClipContextMenu(null);
        setActiveClipEditOperation(operation);
        onPlayheadChange(splitInfo.sec);

        void (async () => {
          try {
            await updateStudioClip(projectId, clip.id, updateRequest);
            await onTracksMutate();
            await onWorkflowsMutate();
            onClipSelect(clip.id, splitInfo.sec);
            toast.success(
              t(
                direction === "left"
                  ? "studioTimelineTrimLeftSuccess"
                  : "studioTimelineTrimRightSuccess"
              )
            );
          } catch (err) {
            try {
              await onTracksMutate();
            } catch {
              // Keep the original update error visible if rollback refresh also fails.
            }
            const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
            toast.error(msg);
          } finally {
            setActiveClipEditOperation(null);
          }
        })();
      });
    },
    [
      activeClipEditOperation,
      onClipSelect,
      onPlayheadChange,
      onTracksMutate,
      onWorkflowsMutate,
      pausePlayback,
      projectId,
      requireLogin,
      splitTargetAtPlayhead,
      t,
    ]
  );

  const handleTrimClipLeftAtPlayhead = useCallback(() => {
    handleTrimClipAtPlayhead("left");
  }, [handleTrimClipAtPlayhead]);

  const handleTrimClipRightAtPlayhead = useCallback(() => {
    handleTrimClipAtPlayhead("right");
  }, [handleTrimClipAtPlayhead]);

  const handleSplitClipAtPlayhead = useCallback(() => {
    if (activeClipEditOperation != null) return;
    if (!splitTargetAtPlayhead) {
      toast.error(t("studioTimelineCutTooClose"));
      return;
    }

    const { clip, trackId, splitInfo } = splitTargetAtPlayhead;
    const { sec: splitSec, leftDurationSec, rightDurationSec } = splitInfo;
    const createRequest = buildSplitClipCreateRequest(clip, splitSec, rightDurationSec);
    if (!createRequest) {
      toast.error(t("studioTimelineCutUnsupported"));
      return;
    }

    requireLogin(() => {
      pausePlayback();
      setClipContextMenu(null);
      setActiveClipEditOperation("split");
      onPlayheadChange(splitSec);

      void (async () => {
        let originalUpdated = false;
        const originalUpdate: StudioUpdateClipRequest = {
          duration_sec: leftDurationSec,
        };
        const newClipUpdate: StudioUpdateClipRequest = {
          track_id: trackId,
          start_sec: splitSec,
          duration_sec: rightDurationSec,
          transform: clip.transform ?? null,
        };

        if (clip.media_type === "video") {
          const mediaStartSec = clip.media_start_sec ?? 0;
          const mediaSplitSec = roundTimelineSec(mediaStartSec + leftDurationSec);
          const mediaEndSec = clip.media_end_sec ?? mediaStartSec + clip.duration_sec;
          originalUpdate.media_end_sec = mediaSplitSec;
          newClipUpdate.media_start_sec = mediaSplitSec;
          newClipUpdate.media_end_sec = roundTimelineSec(mediaEndSec);
        }

        if (clip.text_content != null && clip.workflow_node_output_id == null) {
          newClipUpdate.text_content = clip.text_content;
        }

        try {
          await updateStudioClip(projectId, clip.id, originalUpdate);
          originalUpdated = true;
          const createdClip = await createStudioClip(projectId, createRequest);
          const updatedClip = await updateStudioClip(projectId, createdClip.id, newClipUpdate);
          await onTracksMutate();
          await onWorkflowsMutate();
          onClipSelect(updatedClip.id, splitSec);
          toast.success(t("studioTimelineCutSuccess"));
        } catch (err) {
          if (originalUpdated) {
            try {
              await updateStudioClip(projectId, clip.id, {
                duration_sec: clip.duration_sec,
                media_end_sec: clip.media_type === "video" ? (clip.media_end_sec ?? null) : undefined,
              });
            } catch {
              // Keep the original error visible; a fresh mutate below will show the latest server state.
            }
            await onTracksMutate();
          }

          const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
          toast.error(msg);
        } finally {
          setActiveClipEditOperation(null);
        }
      })();
    });
  }, [
    activeClipEditOperation,
    onClipSelect,
    onPlayheadChange,
    onTracksMutate,
    onWorkflowsMutate,
    pausePlayback,
    projectId,
    requireLogin,
    splitTargetAtPlayhead,
    t,
  ]);

  const handlePlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      pausePlayback();
      dragPlayheadRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pausePlayback]
  );

  const handlePlayheadPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragPlayheadRef.current) return;
      onPlayheadChange(resolveSecFromEvent(e.clientX));
    },
    [onPlayheadChange, resolveSecFromEvent]
  );

  const handlePlayheadPointerUp = useCallback((e: React.PointerEvent) => {
    dragPlayheadRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleCreateEmptyClip = useCallback(() => {
    requireLogin(() => {
      pausePlayback();
      void (async () => {
        setCreating(true);
        try {
          await createStudioClip(projectId, {
            source_type: "empty",
            media_type: "text",
            start_sec: playheadRef.current,
            duration_sec: 5,
            title: t("studioTimelineCreateClip"),
          });
          await onTracksMutate();
          toast.success(t("studioTimelineCreateClipSuccess"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
          toast.error(msg);
        } finally {
          setCreating(false);
        }
      })();
    });
  }, [pausePlayback, projectId, playheadRef, onTracksMutate, requireLogin, t]);

  const handleCreateTrack = useCallback(() => {
    requireLogin(() => {
      pausePlayback();
      void (async () => {
        setCreatingTrack(true);
        try {
          await createStudioTrack(projectId, {
            title: t("studioTimelineTrackDefault").replace(
              "{number}",
              String(tracks.length + 1)
            ),
          });
          await onTracksMutate();
          toast.success(t("studioTimelineAddTrackSuccess"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
          toast.error(msg);
        } finally {
          setCreatingTrack(false);
        }
      })();
    });
  }, [onTracksMutate, pausePlayback, projectId, requireLogin, t, tracks.length]);

  const handleUploadFile = useCallback(
    (file: File) => {
      requireLogin(() => {
        pausePlayback();
        void (async () => {
          setUploading(true);
          try {
            const clip = await uploadStudioClipAtPlayhead({
              projectId,
              playheadSec: playheadRef.current,
              aspectRatio,
              file,
            });
            await onTracksMutate();
            await onWorkflowsMutate();
            onClipCreated?.(clip.id, clip.workflow_id, clip.start_sec);
            toast.success(t("studioTimelineUploadSuccess"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
            toast.error(msg);
          } finally {
            setUploading(false);
          }
        })();
      });
    },
    [
      aspectRatio,
      onTracksMutate,
      onClipCreated,
      onWorkflowsMutate,
      pausePlayback,
      playheadRef,
      projectId,
      requireLogin,
      t,
    ]
  );

  const handleLocalAssetDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes(STUDIO_LOCAL_ASSET_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleLocalAssetDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const payload = parseLocalAssetDragData(e.dataTransfer);
      if (!payload) return;

      e.preventDefault();
      e.stopPropagation();

      const startSec = resolveSecFromEvent(e.clientX);
      const targetTrack = resolveTrackFromEvent(e.clientY);
      if (targetTrack?.is_locked) {
        toast.error(t("studioTransformTrackLocked"));
        return;
      }

      requireLogin(() => {
        pausePlayback();
        setClipContextMenu(null);
        onPlayheadChange(startSec);
        void (async () => {
          setUploading(true);
          try {
            const clip = await createLocalAssetClip({
              projectId,
              payload,
              startSec,
              aspectRatio,
            });
            const placedClip =
              targetTrack && targetTrack.id !== clip.track_id
                ? await updateStudioClip(projectId, clip.id, {
                    track_id: targetTrack.id,
                    start_sec: startSec,
                  })
                : clip;
            await onTracksMutate();
            await onWorkflowsMutate();
            onClipCreated?.(placedClip.id, placedClip.workflow_id, placedClip.start_sec);
            toast.success(t("studioTimelineLocalAssetSuccess"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : t("studioTimelineSaveFailed");
            toast.error(msg);
          } finally {
            setUploading(false);
          }
        })();
      });
    },
    [
      aspectRatio,
      onClipCreated,
      onPlayheadChange,
      onTracksMutate,
      onWorkflowsMutate,
      pausePlayback,
      projectId,
      requireLogin,
      resolveSecFromEvent,
      resolveTrackFromEvent,
      t,
    ]
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="flex h-8 w-full shrink-0 cursor-pointer items-center justify-center gap-2 border-t border-white/10 bg-background/80 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="h-4 w-4 rotate-180" />
        {t("studioTimeline")}
      </button>
    );
  }

  return (
    <footer className="flex h-full min-h-0 flex-col border-t border-white/10 bg-background/90">
      <StudioTimelineToolbar
        playheadSec={playheadSec}
        contentEndSec={contentEndSec}
        timelineZoom={timelineZoom}
        isPlaying={isPlaying}
        creatingClip={creating}
        uploading={uploading}
        onSkipToStart={onSkipToStart}
        onSkipToEnd={onSkipToEnd}
        onTogglePlay={onTogglePlay}
        onZoomChange={onZoomChange}
        onCreateClip={handleCreateEmptyClip}
        onUploadClick={() => fileInputRef.current?.click()}
        selectedClipCount={selectedClipIds.length}
        onRenameClip={handleRenameSelectedClip}
        onDeleteClip={handleDeleteSelectedClip}
        canEditClipAtPlayhead={splitTargetAtPlayhead != null}
        activeClipEditOperation={activeClipEditOperation}
        onTrimClipLeftAtPlayhead={handleTrimClipLeftAtPlayhead}
        onSplitClipAtPlayhead={handleSplitClipAtPlayhead}
        onTrimClipRightAtPlayhead={handleTrimClipRightAtPlayhead}
        leftSelectableClipCount={directionalSelection.left.length}
        rightSelectableClipCount={directionalSelection.right.length}
        onSelectAllLeft={handleSelectAllLeft}
        onSelectAllRight={handleSelectAllRight}
        capturingKeyframe={capturingKeyframe}
        onCaptureKeyframe={onCaptureKeyframe}
        onCollapse={onCollapse}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1">
        <div style={{ width: TRACK_LABEL_WIDTH }}>
          <StudioTrackLabelColumn
            tracks={sortedTracks}
            selectedTrackId={selectedTrackId}
            creatingTrack={creatingTrack}
            deletingTrack={deletingTrack}
            onSelectTrack={handleSelectTrack}
            onCreateTrack={handleCreateTrack}
            onDeleteTrack={handleDeleteTrack}
          />
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: layoutWidth,
              minHeight: RULER_HEIGHT + sortedTracks.length * trackRowStride() + 8,
              ["--timeline-minor-step-px" as string]: `${rulerSteps.minorStepPx}px`,
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endCanvasScrub}
            onPointerCancel={endCanvasScrub}
            onDragOver={handleLocalAssetDragOver}
            onDrop={handleLocalAssetDrop}
          >
            <div className="pointer-events-none absolute inset-0 z-30">
              <div
                ref={playheadDivRef}
                className="studio-playhead pointer-events-auto absolute inset-y-0 z-10 flex h-full -translate-x-1/2 flex-col items-center"
                onPointerDown={handlePlayheadPointerDown}
                onPointerMove={handlePlayheadPointerMove}
                onPointerUp={handlePlayheadPointerUp}
              >
                <div className="studio-playhead-head" />
                <div className="studio-playhead-line min-h-0 w-0.5 flex-1" />
              </div>
            </div>

            <TimeRulerRow ticks={ticks} bands={rulerBands} />

            {isDragging &&
            draggingClip &&
            dragPreview &&
            dragOrigin &&
            dragPreview.trackId !== dragOrigin.trackId ? (
              <ClipDragOverlay
                clip={draggingClip}
                preview={dragPreview}
                targetTrackIndex={targetTrackIndex}
                pxPerSec={pxPerSec}
              />
            ) : null}

            <section className="relative pb-2">
              {sortedTracks.length === 0 ? (
                <div className="mt-2 w-full border border-dashed border-white/15 py-6 text-center text-xs text-muted-foreground">
                  {t("studioTimelineCreateClip")}
                </div>
              ) : (
                sortedTracks.map((track, trackIndex) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    pxPerSec={pxPerSec}
                    selectedClipIds={selectedClipIdSet}
                    missingLocalClipIds={missingLocalClipIds}
                    missingLocalClipLabel={t("studioLocalAssetsMissing")}
                    dragPreview={dragPreview}
                    dragOrigin={dragOrigin}
                    isDropTarget={targetTrackIndex === trackIndex}
                    getClipStyle={getClipStyle}
                    onClipPointerDown={handleClipPointerDown}
                    onClipContextMenu={handleClipContextMenu}
                  />
                ))
              )}
            </section>
          </div>
        </div>
      </div>

      {clipContextMenu ? (
        <StudioClipContextMenu
          open
          x={clipContextMenu.x}
          y={clipContextMenu.y}
          onRename={() => setRenameTarget(clipContextMenu.clip)}
          onDelete={() => setDeleteClipTarget(clipContextMenu.clip)}
          onClose={() => setClipContextMenu(null)}
        />
      ) : null}

      <StudioClipRenameDialog
        open={renameTarget != null}
        initialTitle={renameTarget?.title ?? ""}
        loading={renamingClip}
        onConfirm={handleConfirmRenameClip}
        onCancel={() => {
          if (!renamingClip) setRenameTarget(null);
        }}
      />

      <ConfirmDialog
        open={confirmDeleteTrackOpen}
        title={t("studioTimelineDeleteTrackConfirm")}
        description={t("studioTimelineDeleteTrackConfirmDesc")}
        loading={deletingTrack}
        onConfirm={handleConfirmDeleteTrack}
        onCancel={() => {
          if (!deletingTrack) setConfirmDeleteTrackOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteClipTarget != null}
        title={
          selectedClips.length > 1
            ? t("studioTimelineDeleteSelectedClipsConfirm")
            : t("studioTimelineDeleteClipConfirm")
        }
        description={
          selectedClips.length > 1
            ? t("studioTimelineDeleteSelectedClipsConfirmDesc")
            : t("studioTimelineDeleteClipConfirmDesc")
        }
        loading={deletingClip}
        onConfirm={handleConfirmDeleteClip}
        onCancel={() => {
          if (!deletingClip) setDeleteClipTarget(null);
        }}
      />
    </footer>
  );
}

function roundTimelineSec(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getClipSplitInfo(clip: StudioClipResponse, rawSplitSec: number): ClipSplitInfo {
  const clipEndSec = clip.start_sec + clip.duration_sec;
  const splitSec = roundTimelineSec(
    Math.max(clip.start_sec, Math.min(clipEndSec, rawSplitSec))
  );

  return {
    sec: splitSec,
    leftDurationSec: roundTimelineSec(splitSec - clip.start_sec),
    rightDurationSec: roundTimelineSec(clipEndSec - splitSec),
  };
}

function buildTrimClipUpdateRequest(
  clip: StudioClipResponse,
  splitInfo: ClipSplitInfo,
  direction: "left" | "right"
): StudioUpdateClipRequest {
  const update: StudioUpdateClipRequest =
    direction === "left"
      ? {
          start_sec: splitInfo.sec,
          duration_sec: splitInfo.rightDurationSec,
        }
      : {
          duration_sec: splitInfo.leftDurationSec,
        };

  if (clip.media_type === "video") {
    const mediaStartSec = clip.media_start_sec ?? 0;
    const mediaSplitSec = roundTimelineSec(mediaStartSec + splitInfo.leftDurationSec);

    if (direction === "left") {
      update.media_start_sec = mediaSplitSec;
    } else {
      update.media_end_sec = mediaSplitSec;
    }
  }

  return update;
}

function canSplitClipAtSec(clip: StudioClipResponse, sec: number): boolean {
  const splitInfo = getClipSplitInfo(clip, sec);
  return (
    splitInfo.leftDurationSec >= MIN_SPLIT_SEGMENT_SEC &&
    splitInfo.rightDurationSec >= MIN_SPLIT_SEGMENT_SEC
  );
}

function findSplitTargetAtSec({
  selectedClipIds,
  sortedTracks,
  sec,
}: {
  selectedClipIds: number[];
  sortedTracks: StudioTimelineTrackResponse[];
  sec: number;
}): SplitTarget | null {
  const selectedClipIdSet = new Set(selectedClipIds);

  if (selectedClipIdSet.size > 0) {
    for (const track of sortedTracks) {
      if (track.is_locked) continue;

      for (const clip of track.clips ?? []) {
        if (!selectedClipIdSet.has(clip.id) || !canSplitClipAtSec(clip, sec)) continue;
        return {
          clip,
          trackId: track.id,
          splitInfo: getClipSplitInfo(clip, sec),
        };
      }
    }

    return null;
  }

  for (const track of sortedTracks) {
    if (track.is_locked) continue;

    for (const clip of track.clips ?? []) {
      if (!canSplitClipAtSec(clip, sec)) continue;
      return {
        clip,
        trackId: track.id,
        splitInfo: getClipSplitInfo(clip, sec),
      };
    }
  }

  return null;
}

function toStudioClipMediaType(mediaType: string): StudioClipMediaType | null {
  if (mediaType === "text" || mediaType === "image" || mediaType === "video") {
    return mediaType;
  }
  return null;
}

function buildSplitClipCreateRequest(
  clip: StudioClipResponse,
  startSec: number,
  durationSec: number
): CreateStudioClipRequest | null {
  const mediaType = toStudioClipMediaType(clip.media_type);
  if (!mediaType) return null;

  const base = {
    start_sec: startSec,
    duration_sec: durationSec,
    title: clip.title ?? null,
  };

  if (clip.workflow_node_output_id != null) {
    return {
      ...base,
      source_type: "node_output",
      workflow_node_output_id: clip.workflow_node_output_id,
    };
  }

  if (clip.media_url && mediaType !== "text") {
    return {
      ...base,
      source_type: "upload",
      media_type: mediaType,
      object_key: clip.media_url,
      source_duration_sec: clip.source_duration_sec ?? null,
      aspect_ratio: clip.aspect_ratio ?? null,
    };
  }

  return {
    ...base,
    source_type: "empty",
    media_type: mediaType,
  };
}

function TimeRulerRow({
  ticks,
  bands,
}: {
  ticks: TimeRulerTick[];
  bands: { leftPx: number; widthPx: number }[];
}) {
  return (
    <div
      className="studio-timeline-ruler relative z-10 shrink-0 overflow-hidden border-b border-white/10"
      style={{ height: RULER_HEIGHT }}
    >
      {bands.map((band) => (
        <div
          key={band.leftPx}
          className="pointer-events-none absolute inset-y-0 bg-white/[0.025]"
          style={{ left: band.leftPx, width: band.widthPx }}
        />
      ))}
      {ticks.map((tick) => (
        <div
          key={`${tick.sec}-${tick.leftPx}`}
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: tick.leftPx, height: "100%" }}
        >
          {tick.label ? (
            <span className="font-mono -translate-x-1/2 whitespace-nowrap pb-0.5 text-[10px] leading-none text-muted-foreground">
              {tick.label}
            </span>
          ) : (
            <span className="h-3 shrink-0" />
          )}
          <div
            className={
              tick.isMajor
                ? "studio-timeline-ruler-tick-major"
                : "studio-timeline-ruler-tick-minor"
            }
          />
        </div>
      ))}
    </div>
  );
}

interface TrackRowProps {
  track: StudioTimelineTrackResponse;
  pxPerSec: number;
  selectedClipIds: ReadonlySet<number>;
  missingLocalClipIds: ReadonlySet<number>;
  missingLocalClipLabel: string;
  dragPreview: ReturnType<typeof useClipDrag>["preview"];
  getClipStyle: ReturnType<typeof useClipDrag>["getClipStyle"];
  onClipPointerDown: (
    e: React.PointerEvent,
    clip: StudioClipResponse,
    trackId: number
  ) => void;
  onClipContextMenu: (e: React.MouseEvent, clip: StudioClipResponse) => void;
  dragOrigin: ReturnType<typeof useClipDrag>["origin"];
  isDropTarget: boolean;
}

function TrackRow({
  track,
  pxPerSec,
  selectedClipIds,
  missingLocalClipIds,
  missingLocalClipLabel,
  dragPreview,
  dragOrigin,
  isDropTarget,
  getClipStyle,
  onClipPointerDown,
  onClipContextMenu,
}: TrackRowProps) {
  const clips = track.clips ?? [];

  return (
    <div
      className={
        "relative w-full bg-white/5 " +
        (isDropTarget ? "ring-1 ring-inset ring-accent/40" : "")
      }
      style={{ height: TRACK_ROW_HEIGHT, marginBottom: TRACK_GAP }}
    >
      {clips.map((clip) => {
        const style = getClipStyle(clip, track.id);
        const missingLocalClip = missingLocalClipIds.has(clip.id);

        if (style.isPlaceholder && dragOrigin) {
          return (
            <div
              key={`${clip.id}-placeholder`}
              className="pointer-events-none absolute top-1 bottom-1 rounded border border-dashed border-white/20 bg-white/5 opacity-40"
              style={{
                left: dragOrigin.startSec * pxPerSec,
                width: Math.max(24, clip.duration_sec * pxPerSec),
              }}
            />
          );
        }

        if (
          style.isDragging &&
          dragPreview &&
          !dragPreview.groupItems &&
          dragPreview.trackId !== track.id
        ) {
          return null;
        }

        return (
          <button
            key={clip.id}
            type="button"
            data-clip-block
            onPointerDown={(e) => onClipPointerDown(e, clip, track.id)}
            onContextMenu={(e) => onClipContextMenu(e, clip)}
            title={missingLocalClip ? missingLocalClipLabel : undefined}
            className={
              "absolute top-1 bottom-1 cursor-grab overflow-hidden rounded border px-1 text-[10px] text-foreground active:cursor-grabbing " +
              (style.conflict
                ? "border-destructive bg-destructive/20"
                : missingLocalClip
                  ? "border-destructive/70 bg-destructive/20 text-destructive"
                : selectedClipIds.has(clip.id)
                  ? "border-accent bg-accent/25 ring-1 ring-accent/50"
                  : "border-primary/30 bg-primary/20 hover:border-primary/60")
            }
            style={{
              left: style.left,
              width: style.width,
            }}
          >
            {clip.title || clip.media_type}
          </button>
        );
      })}
    </div>
  );
}

function ClipDragOverlay({
  clip,
  preview,
  targetTrackIndex,
  pxPerSec,
}: {
  clip: StudioClipResponse;
  preview: NonNullable<ReturnType<typeof useClipDrag>["preview"]>;
  targetTrackIndex: number | null;
  pxPerSec: number;
}) {
  if (targetTrackIndex == null) return null;
  const top = trackAreaTop(targetTrackIndex) + 4;
  const width = Math.max(24, clip.duration_sec * pxPerSec);

  return (
    <div
      className={
        "pointer-events-none absolute z-20 rounded border border-dashed px-1 text-[10px] text-foreground " +
        (preview.hasConflict
          ? "border-destructive/70 bg-destructive/15"
          : "border-accent/70 bg-accent/15")
      }
      style={{
        top,
        left: preview.startSec * pxPerSec,
        width,
        height: TRACK_ROW_HEIGHT - 8,
      }}
    >
      <span className="block truncate pt-0.5">{clip.title || clip.media_type}</span>
    </div>
  );
}

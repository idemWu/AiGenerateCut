"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mutate as swrMutate } from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FolderOpen,
  GitBranch,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { withLocalePath } from "@/lib/i18n/routing";
import {
  createStudioClip,
  createStudioImageGeneration,
  createStudioTextGeneration,
  createStudioVideoGeneration,
  createStudioWorkflow,
  listStudioTracks,
  retryStudioWorkflowNode,
  updateStudioClipContent,
} from "@/lib/api/studio";
import {
  deriveStudioAiContextMode,
  findClipInTracks,
  resolveStudioAiWorkflowId,
} from "@/lib/studio/studioClipUtils";
import { getModelsForOperationType } from "@/lib/studio/studioAiModels";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import {
  buildVideoProviderParams,
  buildGenerationInputs,
  clampVideoProviderQuality,
  clampVideoDuration,
  clearCoreVideoReferences,
  filterVideoAspectRatio,
  isKelingV3OmniVideoGenerationModel,
  referencesHaveVideoInput,
  validateGenerationRequest,
  type StudioAiReference,
  type StudioAiValidationErrorKey,
  type StudioImageSize,
  type StudioVideoMode,
  type StudioVideoProviderQuality,
} from "@/lib/studio/studioAiResources";
import { pruneVideoPool, removeClipFromVideoPool } from "@/lib/studio/playback/videoPool";
import { useRequireLogin } from "@/lib/hooks/useRequireLogin";
import AccountButton from "@/components/auth/AccountButton";
import AppSettingsButton from "@/components/settings/AppSettingsButton";
import StudioLeftPanel from "@/components/studio/layout/StudioLeftPanel";
import StudioRightPanel, {
  type StudioResourceTab,
} from "@/components/studio/layout/StudioRightPanel";
import StudioWorkspaceLayout from "@/components/studio/layout/StudioWorkspaceLayout";
import StudioExportDialog from "@/components/studio/export/StudioExportDialog";
import StudioPreviewPlayer, {
  type StudioPreviewPlayerHandle,
} from "@/components/studio/preview/StudioPreviewPlayer";
import { resolveKeyframeSourceClip } from "@/lib/studio/buildCreateKeyframeRequest";
import { uploadStudioKeyframeFromBlob } from "@/lib/studio/uploadStudioKeyframe";
import StudioTimeline from "@/components/studio/timeline/StudioTimeline";
import { getContentEndSec } from "@/lib/studio/playback/playbackSchedule";
import { useStudioPlayback } from "@/lib/studio/playback/useStudioPlayback";
import {
  useStudioProject,
  useStudioTracks,
  useStudioWorkflows,
  useStudioWorkflowNodes,
  useStudioKeyframes,
  useStudioAssets,
  useStudioAiModels,
} from "@/lib/hooks/useStudio";
import { useStudioEditorStore } from "@/lib/stores/studioEditorStore";
import {
  buildPendingNodeInputThumbs,
  type PendingNodeInputThumb,
} from "@/lib/studio/ai/buildPendingNodeInputThumbs";
import {
  isStudioRequestTimeout,
  runStudioGenerationAfterCreate,
} from "@/lib/studio/ai/runStudioNodeGeneration";
import {
  toggleStudioPanelPlacement,
  type StudioPanelPlacement,
} from "@/lib/studio/studioEditorLayout";
import type {
  StudioClipResponse,
  StudioAspectRatio,
  StudioProjectResponse,
  StudioTimelineTrackResponse,
  StudioWorkflowNodeResponse,
} from "@/lib/api/studio";

interface StudioEditorClientProps {
  projectId: number;
}

export default function StudioEditorClient({ projectId }: StudioEditorClientProps) {
  const { t, locale } = useLanguage();
  const { project, isLoading: projectLoading } = useStudioProject(projectId);

  if (projectLoading) {
    return (
      <section className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  if (!project) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("studioProjectNotFound")}</p>
        <Link href={withLocalePath(locale, "/studio")} className="text-primary">
          {t("back")}
        </Link>
      </section>
    );
  }

  return <StudioEditorWorkspace projectId={projectId} project={project} />;
}

interface StudioEditorWorkspaceProps {
  projectId: number;
  project: StudioProjectResponse;
}

function moveClipInTracks(
  tracks: StudioTimelineTrackResponse[] | undefined,
  clipId: number,
  targetTrackId: number,
  startSec: number
): StudioTimelineTrackResponse[] | undefined {
  if (!tracks) return tracks;

  let movedClip: StudioClipResponse | null = null;
  const tracksWithoutClip = tracks.map((track) => {
    const clips = track.clips ?? [];
    const nextClips = clips.filter((clip) => {
      if (clip.id !== clipId) return true;

      movedClip = {
        ...clip,
        track_id: targetTrackId,
        start_sec: startSec,
        end_sec: Math.round((startSec + clip.duration_sec) * 1000) / 1000,
      };
      return false;
    });

    return nextClips.length === clips.length ? track : { ...track, clips: nextClips };
  });

  const clipToMove = movedClip;
  if (!clipToMove) return tracks;

  return tracksWithoutClip.map((track) => {
    if (track.id !== targetTrackId) return track;

    return {
      ...track,
      clips: [...(track.clips ?? []), clipToMove].sort(
        (a, b) => a.start_sec - b.start_sec || a.id - b.id
      ),
    };
  });
}

function StudioEditorWorkspace({ projectId, project }: StudioEditorWorkspaceProps) {
  const { t, locale } = useLanguage();
  const { tracks, mutate: mutateTracks } = useStudioTracks(projectId);
  const refreshTracks = useCallback(async () => {
    const fresh = await listStudioTracks(projectId);
    await mutateTracks(fresh, { revalidate: false });
  }, [projectId, mutateTracks]);
  const handleClipOptimisticMove = useCallback(
    async (clipId: number, trackId: number, startSec: number) => {
      await mutateTracks(
        (current) => moveClipInTracks(current, clipId, trackId, startSec),
        { revalidate: false }
      );
    },
    [mutateTracks]
  );
  const { workflows, mutate: mutateWorkflows } = useStudioWorkflows(projectId);
  const { keyframes, mutate: mutateKeyframes } = useStudioKeyframes(projectId);
  const { mutate: mutateAssets } = useStudioAssets(projectId);
  const { models: aiModels } = useStudioAiModels();
  const previewCaptureRef = useRef<StudioPreviewPlayerHandle>(null);
  const [capturingKeyframe, setCapturingKeyframe] = useState(false);

  const requireLogin = useRequireLogin();
  const toolMode = useStudioEditorStore((s) => s.toolMode);
  const activeWorkflowId = useStudioEditorStore((s) => s.activeWorkflowId);
  const selectedModelByType = useStudioEditorStore((s) => s.selectedModelByType);
  const playheadSec = useStudioEditorStore((s) => s.playheadSec);
  const isPlaying = useStudioEditorStore((s) => s.isPlaying);
  const timelineZoom = useStudioEditorStore((s) => s.timelineZoom);
  const setToolMode = useStudioEditorStore((s) => s.setToolMode);
  const setActiveWorkflowId = useStudioEditorStore((s) => s.setActiveWorkflowId);
  const setSelectedModelForType = useStudioEditorStore((s) => s.setSelectedModelForType);
  const setPlayheadSec = useStudioEditorStore((s) => s.setPlayheadSec);
  const setIsPlaying = useStudioEditorStore((s) => s.setIsPlaying);
  const pausePlayback = useStudioEditorStore((s) => s.pausePlayback);
  const setTimelineZoom = useStudioEditorStore((s) => s.setTimelineZoom);
  const selectedClipId = useStudioEditorStore((s) => s.selectedClipId);
  const setSelectedClipId = useStudioEditorStore((s) => s.setSelectedClipId);

  const selectedClip = useMemo(
    () => findClipInTracks(tracks, selectedClipId),
    [tracks, selectedClipId]
  );

  const aiContextMode = useMemo(
    () => deriveStudioAiContextMode(selectedClip, activeWorkflowId),
    [selectedClip, activeWorkflowId]
  );

  const aiWorkflowId = useMemo(
    () => resolveStudioAiWorkflowId(selectedClip, activeWorkflowId),
    [selectedClip, activeWorkflowId]
  );

  const { nodes } = useStudioWorkflowNodes(projectId, aiWorkflowId);

  const [prompt, setPrompt] = useState("");
  const [aiOperationType, setAiOperationType] = useState<StudioAiOperationType>("image");
  const [references, setReferences] = useState<StudioAiReference[]>([]);
  const [imageAspectRatio, setImageAspectRatio] = useState<StudioAspectRatio>(
    (project.aspect_ratio as StudioAspectRatio) ?? "16:9"
  );
  const [imageSize, setImageSize] = useState<StudioImageSize>("1K");
  const [generateCount, setGenerateCount] = useState(1);
  const [videoMode, setVideoMode] = useState<StudioVideoMode>("text2video");
  const [videoAspectRatio, setVideoAspectRatio] = useState<StudioAspectRatio>(() =>
    filterVideoAspectRatio(project.aspect_ratio as StudioAspectRatio)
  );
  const [videoDurationSec, setVideoDurationSec] = useState(5);
  const [videoQuality, setVideoQuality] = useState<StudioVideoProviderQuality>("pro");
  const [generating, setGenerating] = useState(false);
  const [creatingClip, setCreatingClip] = useState(false);
  const [pendingInputThumbsByNodeId, setPendingInputThumbsByNodeId] = useState<
    Map<number, PendingNodeInputThumb[]>
  >(() => new Map());
  const [leftLayout, setLeftLayout] = useState<StudioPanelPlacement>("topRow");
  const [rightLayout, setRightLayout] = useState<StudioPanelPlacement>("topRow");
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [resourceTab, setResourceTab] = useState<StudioResourceTab>("keyframes");
  const [exportOpen, setExportOpen] = useState(false);
  const videoPoolRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const playheadRef = useRef(playheadSec);
  playheadRef.current = playheadSec;
  /** 最后一个 active clip 的结束时间（与播放终点、导出长度一致） */
  const contentEndSec = useMemo(() => getContentEndSec(tracks), [tracks]);

  /** 标尺可滚动/拖动的总长度（尾部留白，仅用于编辑区，不用于 UI 总时长与导出） */
  const timelineDurationSec = useMemo(() => {
    const emptyDefault = 30;
    const tailPad = 5;
    if (contentEndSec <= 0) return emptyDefault;
    return Math.max(emptyDefault, contentEndSec + tailPad);
  }, [contentEndSec]);

  const { togglePlay, skipToStart, skipToEnd, seek, subscribePlayhead } = useStudioPlayback({
    tracks,
    durationSec: timelineDurationSec,
    playheadSec,
    isPlaying,
    playheadRef,
    videoPoolRef,
    setPlayheadSec,
    setIsPlaying,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, button, [contenteditable='true'], [role='textbox']"
        )
      ) {
        return;
      }

      e.preventDefault();
      togglePlay();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  useEffect(() => {
    document.body.classList.add("workspace-mode");
    return () => document.body.classList.remove("workspace-mode");
  }, []);

  useEffect(() => {
    pruneVideoPool(videoPoolRef.current, tracks);
  }, [tracks]);

  useEffect(() => {
    if (selectedClipId == null) return;
    if (!selectedClip) {
      setSelectedClipId(null);
    }
  }, [selectedClip, selectedClipId, setSelectedClipId]);

  const handleNewWorkflow = useCallback(async () => {
    try {
      const w = await createStudioWorkflow(projectId, {
        title: t("studioWorkflowDefaultTitle").replace(
          "{number}",
          String(workflows.length + 1)
        ),
      });
      await mutateWorkflows();
      setActiveWorkflowId(w.id);
      toast.success(t("studioWorkflowCreated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
    }
  }, [projectId, workflows.length, mutateWorkflows, setActiveWorkflowId, t]);

  const typeModels = useMemo(
    () => getModelsForOperationType(aiModels, aiOperationType),
    [aiModels, aiOperationType]
  );

  const selectedModelId = selectedModelByType[aiOperationType] ?? "";

  const currentModel = useMemo(
    () => typeModels.find((m) => m.id === selectedModelId),
    [typeModels, selectedModelId]
  );

  const hasVideoInput = useMemo(
    () => referencesHaveVideoInput(references),
    [references]
  );

  const applyOutputToClip = useCallback(
    async (clipId: number, outputId: number) => {
      removeClipFromVideoPool(videoPoolRef.current, clipId);
      await updateStudioClipContent(projectId, clipId, {
        session_node_output_id: outputId,
      });
      await refreshTracks();
    },
    [projectId, refreshTracks]
  );

  const handleGenerate = useCallback(async () => {
    if (aiContextMode === "create") {
      toast.error(t("studioAiSelectClip"));
      return;
    }

    const validation = validateGenerationRequest({
      operationType: aiOperationType,
      videoMode,
      prompt,
      modelId: selectedModelId,
      references,
    });
    if (!validation.ok && validation.errorKey) {
      const errorKey: StudioAiValidationErrorKey = validation.errorKey;
      toast.error(t(errorKey));
      return;
    }

    if (!currentModel) {
      toast.error(t("studioAiSelectModel"));
      return;
    }

    const workflowId = aiWorkflowId;
    if (!workflowId) {
      toast.error(t("studioAiSelectClipOrWorkflow"));
      return;
    }

    setGenerating(true);
    const refreshNodes = () => swrMutate(["studio-nodes", projectId, workflowId]);
    try {
      const targetClipId = selectedClip?.id ?? null;
      const inputs = buildGenerationInputs(references);

      let node: StudioWorkflowNodeResponse;
      if (aiOperationType === "text") {
        node = await createStudioTextGeneration(projectId, workflowId, {
          prompt: prompt.trim(),
          model: selectedModelId,
          inputs,
        });
      } else if (aiOperationType === "image") {
        node = await createStudioImageGeneration(projectId, workflowId, {
          prompt: prompt.trim(),
          model: selectedModelId,
          aspect_ratio: imageAspectRatio,
          image_size: imageSize,
          generate_count: generateCount,
          inputs,
        });
      } else {
        const duration = clampVideoDuration(
          videoDurationSec,
          hasVideoInput,
          currentModel.supported_durations,
          selectedModelId
        );
        node = await createStudioVideoGeneration(projectId, workflowId, {
          prompt: prompt.trim(),
          model: selectedModelId,
          aspect_ratio: videoAspectRatio,
          duration_sec: duration,
          inputs,
          params: buildVideoProviderParams(selectedModelId, videoQuality),
        });
      }

      setPendingInputThumbsByNodeId((prev) => {
        const next = new Map(prev);
        next.set(node.id, buildPendingNodeInputThumbs(references));
        return next;
      });
      await refreshNodes();
      setPrompt("");
      setReferences([]);
      runStudioGenerationAfterCreate({
        projectId,
        workflowId,
        node,
        refreshNodes,
        autoApplyToClipId: targetClipId,
        applyOutputToClip,
        t,
      });
    } catch (e) {
      await refreshNodes();
      if (isStudioRequestTimeout(e)) {
        toast.message(t("studioAiGenerationStillRunning"));
      } else {
        toast.error(e instanceof Error ? e.message : t("studioAiGenerationFailed"));
      }
    } finally {
      setGenerating(false);
    }
  }, [
    aiContextMode,
    aiOperationType,
    aiWorkflowId,
    applyOutputToClip,
    currentModel,
    generateCount,
    hasVideoInput,
    imageAspectRatio,
    imageSize,
    projectId,
    prompt,
    references,
    selectedClip?.id,
    selectedModelId,
    t,
    videoAspectRatio,
    videoDurationSec,
    videoQuality,
    videoMode,
  ]);

  const handleApplyToClip = useCallback(
    async (outputId: number, _mediaType: string) => {
      if (!selectedClipId) {
        toast.error(t("studioAiSelectClip"));
        return;
      }
      pausePlayback();
      try {
        await applyOutputToClip(selectedClipId, outputId);
        toast.success(t("studioAiApplyToClipSuccess"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    },
    [applyOutputToClip, pausePlayback, selectedClipId, t]
  );

  const handleAddToTimeline = useCallback(
    async (outputId: number, mediaType: string, _duration = 5) => {
      pausePlayback();
      try {
        const clip = await createStudioClip(projectId, {
          start_sec: playheadSec,
          session_node_output_id: outputId,
          title:
            mediaType === "video"
              ? t("studioAiTypeVideo")
              : mediaType === "image"
                ? t("studioAiTypeImage")
                : t("studioAiTypeText"),
        });
        await refreshTracks();
        setSelectedClipId(clip.id);
        setPlayheadSec(clip.start_sec);
        setResourceTab("properties");
        if (clip.workflow_id) {
          setActiveWorkflowId(clip.workflow_id);
        }
        toast.success(t("studioAiCreateAtPlayheadSuccess"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    },
    [
      pausePlayback,
      projectId,
      playheadSec,
      refreshTracks,
      setActiveWorkflowId,
      setPlayheadSec,
      setSelectedClipId,
      t,
    ]
  );

  const handleClipSelect = useCallback(
    (clipId: number, _startSec: number) => {
      pausePlayback();
      setSelectedClipId(clipId);
      const clip = findClipInTracks(tracks, clipId);
      if (clip) {
        setActiveWorkflowId(clip.workflow_id ?? null);
      }
      if (toolMode !== "filters") {
        setToolMode("ai");
      }
      setResourceTab("properties");
    },
    [
      pausePlayback,
      setActiveWorkflowId,
      setSelectedClipId,
      setToolMode,
      toolMode,
      tracks,
    ]
  );

  const handleCreateEmptyClip = useCallback(async () => {
    pausePlayback();
    setCreatingClip(true);
    try {
      const clip = await createStudioClip(projectId, {
        start_sec: playheadSec,
        title: t("studioTimelineCreateClip"),
      });
      await refreshTracks();
      handleClipSelect(clip.id, clip.start_sec);
      toast.success(t("studioTimelineCreateClipSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
    } finally {
      setCreatingClip(false);
    }
  }, [handleClipSelect, pausePlayback, refreshTracks, playheadSec, projectId, t]);

  useEffect(() => {
    if (typeModels.length === 0) return;
    if (!selectedModelId || !typeModels.some((model) => model.id === selectedModelId)) {
      setSelectedModelForType(aiOperationType, typeModels[0]!.id);
    }
  }, [aiOperationType, selectedModelId, setSelectedModelForType, typeModels]);

  useEffect(() => {
    setReferences([]);
  }, [aiOperationType, videoMode]);

  useEffect(() => {
    if (aiOperationType !== "video" || videoMode !== "first_frame") return;
    if (isKelingV3OmniVideoGenerationModel(selectedModelId)) return;
    setVideoMode("first_last_frame");
    setReferences((prev) => clearCoreVideoReferences(prev));
  }, [aiOperationType, selectedModelId, videoMode]);

  useEffect(() => {
    if (!currentModel?.supported_image_sizes?.length) return;
    if (!currentModel.supported_image_sizes.includes(imageSize)) {
      setImageSize(currentModel.supported_image_sizes[0]!);
    }
  }, [currentModel, imageSize]);

  useEffect(() => {
    if (aiOperationType !== "video") return;
    const aspectRatio = filterVideoAspectRatio(
      videoAspectRatio,
      currentModel?.supported_aspect_ratios
    );
    if (aspectRatio !== videoAspectRatio) {
      setVideoAspectRatio(aspectRatio);
    }
  }, [aiOperationType, currentModel, videoAspectRatio]);

  useEffect(() => {
    const duration = clampVideoDuration(
      videoDurationSec,
      hasVideoInput,
      currentModel?.supported_durations,
      selectedModelId
    );
    if (duration !== videoDurationSec) {
      setVideoDurationSec(duration);
    }
  }, [hasVideoInput, currentModel, selectedModelId, videoDurationSec]);

  useEffect(() => {
    if (aiOperationType !== "video") return;
    const quality = clampVideoProviderQuality(selectedModelId, videoQuality);
    if (quality !== videoQuality) {
      setVideoQuality(quality);
    }
  }, [aiOperationType, selectedModelId, videoQuality]);

  const handleOperationTypeChange = useCallback((type: StudioAiOperationType) => {
    setAiOperationType(type);
    setReferences([]);
  }, []);

  const handleVideoModeChange = useCallback((mode: StudioVideoMode) => {
    setVideoMode(mode);
    setReferences((prev) => clearCoreVideoReferences(prev));
  }, []);

  const handleModelIdChange = useCallback(
    (id: string) => {
      setSelectedModelForType(aiOperationType, id);
      if (aiOperationType === "video") {
        setReferences((prev) => clearCoreVideoReferences(prev));
      }
    },
    [aiOperationType, setSelectedModelForType]
  );

  const handleClearClipSelection = useCallback(() => {
    setSelectedClipId(null);
    setActiveWorkflowId(null);
  }, [setActiveWorkflowId, setSelectedClipId]);

  const handlePreviewClipSelectionChange = useCallback(
    (clipId: number | null) => {
      setSelectedClipId(clipId);
      if (clipId != null) {
        setResourceTab("properties");
      }
    },
    [setSelectedClipId]
  );

  const toggleLeftLayout = useCallback(() => {
    setLeftLayout((layout) => toggleStudioPanelPlacement(layout));
  }, []);

  const toggleRightLayout = useCallback(() => {
    setRightLayout((layout) => toggleStudioPanelPlacement(layout));
  }, []);

  const leftLayoutToggleTitle =
    leftLayout === "docked" ? t("studioLayoutCollapseUp") : t("studioLayoutExpandDown");

  const rightLayoutToggleTitle =
    rightLayout === "docked" ? t("studioLayoutCollapseUp") : t("studioLayoutExpandDown");

  const handleSelectWorkflow = useCallback(
    (workflowId: number) => {
      setSelectedClipId(null);
      setActiveWorkflowId(workflowId);
      setToolMode("ai");
    },
    [setActiveWorkflowId, setSelectedClipId, setToolMode]
  );

  const aspectRatio = (project.aspect_ratio as StudioAspectRatio) ?? "16:9";

  const handleCaptureKeyframe = useCallback(async () => {
    pausePlayback();
    setCapturingKeyframe(true);
    try {
      const blob = await previewCaptureRef.current?.capturePreviewFrame();
      if (!blob) {
        throw new Error(t("studioPreviewNotReady"));
      }
      const sourceClip = resolveKeyframeSourceClip(tracks, playheadSec, selectedClip);
      await uploadStudioKeyframeFromBlob({
        projectId,
        blob,
        playheadSec,
        sourceClip,
      });
      await mutateKeyframes();
      setResourceTab("keyframes");
      toast.success(t("studioKeyframeCaptureSuccess"));
    } catch (e) {
      const message =
        e instanceof Error && e.message ? e.message : t("studioTimelineSaveFailed");
      toast.error(message);
    } finally {
      setCapturingKeyframe(false);
    }
  }, [
    mutateKeyframes,
    pausePlayback,
    playheadSec,
    projectId,
    selectedClip,
    tracks,
    t,
  ]);

  const leftPanel = (
    <StudioLeftPanel
      projectId={projectId}
      toolMode={toolMode}
      placement={leftLayout}
      layoutToggleTitle={leftLayoutToggleTitle}
      onTogglePlacement={toggleLeftLayout}
      workflows={workflows}
      activeWorkflowId={activeWorkflowId}
      onNewWorkflow={() => void handleNewWorkflow()}
      onSelectWorkflow={handleSelectWorkflow}
      selectedClip={selectedClip}
      aiContextMode={aiContextMode}
      selectedClipTitle={selectedClip?.title ?? null}
      aiWorkflowId={aiWorkflowId}
      nodes={nodes}
      pendingInputThumbsByNodeId={pendingInputThumbsByNodeId}
      aiModels={aiModels}
      operationType={aiOperationType}
      onOperationTypeChange={handleOperationTypeChange}
      modelId={selectedModelId}
      onModelIdChange={handleModelIdChange}
      prompt={prompt}
      onPromptChange={setPrompt}
      generating={generating}
      creatingClip={creatingClip}
      references={references}
      onReferencesChange={setReferences}
      imageAspectRatio={imageAspectRatio}
      onImageAspectRatioChange={setImageAspectRatio}
      imageSize={imageSize}
      onImageSizeChange={setImageSize}
      generateCount={generateCount}
      onGenerateCountChange={setGenerateCount}
      videoMode={videoMode}
      onVideoModeChange={handleVideoModeChange}
      videoAspectRatio={videoAspectRatio}
      onVideoAspectRatioChange={setVideoAspectRatio}
      videoDurationSec={videoDurationSec}
      onVideoDurationSecChange={setVideoDurationSec}
      videoQuality={videoQuality}
      onVideoQualityChange={setVideoQuality}
      hasVideoInput={hasVideoInput}
      requireLogin={requireLogin}
      onBeforeClipFilterUpdate={pausePlayback}
      onTracksMutate={refreshTracks}
      onSubmit={() => requireLogin(() => void handleGenerate())}
      onCreateClip={() => requireLogin(() => void handleCreateEmptyClip())}
      onApplyToClip={(outputId, mediaType) =>
        requireLogin(() => void handleApplyToClip(outputId, mediaType))
      }
      onAddToTimeline={(outputId, mediaType, duration) =>
        requireLogin(() => void handleAddToTimeline(outputId, mediaType, duration))
      }
      onRetry={async (nodeId) => {
        if (!aiWorkflowId) return;
        const refreshNodes = () =>
          swrMutate(["studio-nodes", projectId, aiWorkflowId]);
        try {
          const node = await retryStudioWorkflowNode(projectId, aiWorkflowId, nodeId);
          await refreshNodes();
          runStudioGenerationAfterCreate({
            projectId,
            workflowId: aiWorkflowId,
            node,
            refreshNodes,
            autoApplyToClipId: selectedClipId,
            applyOutputToClip,
            t,
          });
        } catch (e) {
          await refreshNodes();
          if (isStudioRequestTimeout(e)) {
            toast.message(t("studioAiGenerationStillRunning"));
          } else {
            toast.error(
              e instanceof Error ? e.message : t("studioTimelineSaveFailed")
            );
          }
        }
      }}
    />
  );

  const rightPanel = (
    <StudioRightPanel
      placement={rightLayout}
      layoutToggleTitle={rightLayoutToggleTitle}
      onTogglePlacement={toggleRightLayout}
      resourceTab={resourceTab}
      onResourceTabChange={setResourceTab}
      projectId={projectId}
      aspectRatio={aspectRatio}
      aiModels={aiModels}
      keyframes={keyframes}
      selectedClip={selectedClip}
      requireLogin={requireLogin}
      onAssetsMutate={mutateAssets}
      onBeforeClipPropertyUpdate={pausePlayback}
      onTracksMutate={refreshTracks}
    />
  );

  const previewPanel = (
    <main className="relative flex h-full min-h-0 flex-col bg-black/40">
      <StudioPreviewPlayer
        ref={previewCaptureRef}
        projectId={projectId}
        aspectRatio={aspectRatio}
        tracks={tracks}
        playheadSec={playheadSec}
        playheadRef={playheadRef}
        isPlaying={isPlaying}
        selectedClip={selectedClip}
        videoPoolRef={videoPoolRef}
        requireLogin={requireLogin}
        onTracksMutate={refreshTracks}
        setSelectedClipId={handlePreviewClipSelectionChange}
        subscribePlayhead={subscribePlayhead}
      />
    </main>
  );

  const timelineSharedProps = {
    projectId,
    aspectRatio,
    tracks,
    durationSec: timelineDurationSec,
    contentEndSec,
    playheadSec,
    playheadRef,
    subscribePlayhead,
    timelineZoom,
    isPlaying,
    selectedClipId,
    onPlayheadChange: seek,
    onClipSelect: handleClipSelect,
    onClearClipSelection: handleClearClipSelection,
    onTogglePlay: togglePlay,
    onSkipToStart: skipToStart,
    onSkipToEnd: skipToEnd,
    onZoomChange: setTimelineZoom,
    onCollapse: () => setTimelineCollapsed(true),
    onExpand: () => setTimelineCollapsed(false),
    onClipOptimisticMove: handleClipOptimisticMove,
    onTracksMutate: refreshTracks,
    onWorkflowsMutate: mutateWorkflows,
    onClipCreated: (clipId: number, _workflowId: number | null, startSec: number) =>
      handleClipSelect(clipId, startSec),
    capturingKeyframe,
    onCaptureKeyframe: () => requireLogin(() => void handleCaptureKeyframe()),
    requireLogin,
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="app-region-drag electron-window-control-spacer flex h-12 shrink-0 cursor-move items-center gap-3 border-b border-white/10 bg-background/90 px-3 shadow-[0_1px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4">
        <Link
          href={withLocalePath(locale, "/studio")}
          className="app-region-no-drag cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="min-w-0 flex-1 cursor-move truncate font-display text-sm font-semibold sm:text-base">
          {project.title}
        </h1>
        <span className="hidden cursor-move rounded-md border border-white/10 px-2 py-0.5 text-xs text-muted-foreground sm:inline">
          {project.aspect_ratio}
        </span>
        <button
          type="button"
          className="app-region-no-drag cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/10 sm:text-sm"
          onClick={() =>
            requireLogin(() => {
              pausePlayback();
              setExportOpen(true);
            })
          }
        >
          <Download className="mr-1 inline h-3.5 w-3.5" />
          {t("studioExportStart")}
        </button>
        <div className="app-region-no-drag flex items-center gap-2">
          <AccountButton placement="inline" />
          <AppSettingsButton placement="inline" />
        </div>
      </header>

      <section className="flex min-h-0 flex-1">
        <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-white/10 py-2">
          {(
            [
              ["local", FolderOpen, t("studioLocalAssetsTab")],
              ["ai", Sparkles, t("studioAiAssistant")],
              ["workflows", GitBranch, t("studioWorkflowList")],
              ["filters", SlidersHorizontal, t("studioFilters")],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              title={label}
              onClick={() => setToolMode(mode)}
              className={
                "cursor-pointer rounded-lg p-2 transition-colors " +
                (toolMode === mode ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5")
              }
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </nav>

        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <StudioWorkspaceLayout
            leftLayout={leftLayout}
            rightLayout={rightLayout}
            timelineCollapsed={timelineCollapsed}
            leftPanel={leftPanel}
            rightPanel={rightPanel}
            previewPanel={previewPanel}
            timelinePanel={<StudioTimeline {...timelineSharedProps} collapsed={false} />}
          />

          {timelineCollapsed ? (
            <StudioTimeline {...timelineSharedProps} collapsed />
          ) : null}
        </div>
      </section>

      <StudioExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        tracks={tracks}
        contentEndSec={contentEndSec}
        aspectRatio={(project.aspect_ratio as StudioAspectRatio) ?? "16:9"}
        projectTitle={project.title}
      />
    </section>
  );
}


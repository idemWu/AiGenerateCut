"use client";

import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { StudioWorkflowNodeResponse } from "@/lib/api/studio";
import type { StudioAiModelListResponse, StudioAiOperationType } from "@/lib/studio/studioAiModels";
import type {
  StudioAiReference,
  StudioAspectRatio,
  StudioImageSize,
  StudioVideoMode,
} from "@/lib/studio/studioAiResources";
import type { StudioAiContextMode } from "@/lib/studio/studioClipUtils";
import type { PendingNodeInputThumb } from "@/lib/studio/ai/buildPendingNodeInputThumbs";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";
import StudioLayoutToggleButton from "@/components/studio/layout/StudioLayoutToggleButton";
import StudioAiHistory from "./StudioAiHistory";
import StudioAiComposer from "./StudioAiComposer";

interface StudioAiPanelProps {
  projectId: number;
  contextMode: StudioAiContextMode;
  selectedClipTitle: string | null;
  activeWorkflowId: number | null;
  nodes: StudioWorkflowNodeResponse[];
  pendingInputThumbsByNodeId: ReadonlyMap<number, PendingNodeInputThumb[]>;
  models: StudioAiModelListResponse | undefined;
  operationType: StudioAiOperationType;
  onOperationTypeChange: (type: StudioAiOperationType) => void;
  modelId: string;
  onModelIdChange: (id: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  generating: boolean;
  creatingClip?: boolean;
  references: StudioAiReference[];
  onReferencesChange: (refs: StudioAiReference[]) => void;
  imageAspectRatio: StudioAspectRatio;
  onImageAspectRatioChange: (value: StudioAspectRatio) => void;
  imageSize: StudioImageSize;
  onImageSizeChange: (value: StudioImageSize) => void;
  generateCount: number;
  onGenerateCountChange: (value: number) => void;
  videoMode: StudioVideoMode;
  onVideoModeChange: (mode: StudioVideoMode) => void;
  videoAspectRatio: StudioAspectRatio;
  onVideoAspectRatioChange: (value: StudioAspectRatio) => void;
  videoDurationSec: number;
  onVideoDurationSecChange: (value: number) => void;
  hasVideoInput: boolean;
  onSubmit: () => void;
  onCreateClip: () => void;
  onApplyToClip: (outputId: number, mediaType: string, duration?: number) => void;
  onAddToTimeline: (outputId: number, mediaType: string, duration?: number) => void;
  onRetry: (nodeId: number) => Promise<void>;
  placement: StudioPanelPlacement;
  layoutToggleTitle: string;
  onTogglePlacement: () => void;
}

export default function StudioAiPanel({
  projectId,
  contextMode,
  selectedClipTitle,
  activeWorkflowId,
  nodes,
  pendingInputThumbsByNodeId,
  models,
  operationType,
  onOperationTypeChange,
  modelId,
  onModelIdChange,
  prompt,
  onPromptChange,
  generating,
  creatingClip = false,
  references,
  onReferencesChange,
  imageAspectRatio,
  onImageAspectRatioChange,
  imageSize,
  onImageSizeChange,
  generateCount,
  onGenerateCountChange,
  videoMode,
  onVideoModeChange,
  videoAspectRatio,
  onVideoAspectRatioChange,
  videoDurationSec,
  onVideoDurationSecChange,
  hasVideoInput,
  onSubmit,
  onCreateClip,
  onApplyToClip,
  onAddToTimeline,
  onRetry,
  placement,
  layoutToggleTitle,
  onTogglePlacement,
}: StudioAiPanelProps) {
  const { t } = useLanguage();

  const contextHint =
    contextMode === "clip"
      ? t("studioAiClipContext").replace(
          "{title}",
          selectedClipTitle?.trim() || `#${activeWorkflowId ?? ""}`
        )
      : contextMode === "workflow"
        ? t("studioAiWorkflowContext").replace(
            "{id}",
            String(activeWorkflowId ?? "")
          )
        : t("studioAiCreateClipMode");

  const useApplyAction = contextMode === "clip";

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-xs font-medium text-foreground">{t("studioAiAssistant")}</span>
            <span
              className={
                "truncate text-[10px] " +
                (contextMode === "create" ? "text-accent" : "text-muted-foreground")
              }
            >
              {contextHint}
            </span>
          </div>
        </div>
        <StudioLayoutToggleButton
          placement={placement}
          onToggle={onTogglePlacement}
          title={layoutToggleTitle}
        />
      </header>

      {contextMode === "create" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-xs text-muted-foreground">{t("studioAiCreateClipHint")}</p>
          <button
            type="button"
            disabled={creatingClip}
            onClick={onCreateClip}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingClip ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              t("studioTimelineCreateClip")
            )}
          </button>
        </div>
      ) : (
        <>
          <StudioAiHistory
            projectId={projectId}
            nodes={nodes}
            pendingInputThumbsByNodeId={pendingInputThumbsByNodeId}
            useApplyAction={useApplyAction}
            onApplyToClip={onApplyToClip}
            onAddToTimeline={onAddToTimeline}
            onRetry={onRetry}
          />
          <StudioAiComposer
            operationType={operationType}
            onOperationTypeChange={onOperationTypeChange}
            models={models}
            modelId={modelId}
            onModelIdChange={onModelIdChange}
            prompt={prompt}
            onPromptChange={onPromptChange}
            generating={generating}
            references={references}
            onReferencesChange={onReferencesChange}
            imageAspectRatio={imageAspectRatio}
            onImageAspectRatioChange={onImageAspectRatioChange}
            imageSize={imageSize}
            onImageSizeChange={onImageSizeChange}
            generateCount={generateCount}
            onGenerateCountChange={onGenerateCountChange}
            videoMode={videoMode}
            onVideoModeChange={onVideoModeChange}
            videoAspectRatio={videoAspectRatio}
            onVideoAspectRatioChange={onVideoAspectRatioChange}
            videoDurationSec={videoDurationSec}
            onVideoDurationSecChange={onVideoDurationSecChange}
            hasVideoInput={hasVideoInput}
            onSubmit={onSubmit}
          />
        </>
      )}
    </section>
  );
}

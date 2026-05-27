"use client";

import StudioAiPanel from "@/components/studio/ai/StudioAiPanel";
import StudioLayoutToggleButton from "@/components/studio/layout/StudioLayoutToggleButton";
import StudioClipFilterPanel from "@/components/studio/resources/StudioClipFilterPanel";
import StudioLocalAssetsPanel from "@/components/studio/resources/StudioLocalAssetsPanel";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type {
  StudioClipResponse,
  StudioWorkflowNodeResponse,
  StudioWorkflowResponse,
} from "@/lib/api/studio";
import type { StudioAiModelListResponse, StudioAiOperationType } from "@/lib/studio/studioAiModels";
import type {
  StudioAiReference,
  StudioAspectRatio,
  StudioImageSize,
  StudioVideoMode,
  StudioVideoProviderQuality,
} from "@/lib/studio/studioAiResources";
import type { StudioAiContextMode } from "@/lib/studio/studioClipUtils";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";
import type { PendingNodeInputThumb } from "@/lib/studio/ai/buildPendingNodeInputThumbs";
import type { StudioToolMode } from "@/lib/stores/studioEditorStore";

interface StudioLeftPanelProps {
  projectId: number;
  toolMode: StudioToolMode;
  placement: StudioPanelPlacement;
  layoutToggleTitle: string;
  onTogglePlacement: () => void;
  workflows: StudioWorkflowResponse[];
  activeWorkflowId: number | null;
  onNewWorkflow: () => void;
  onSelectWorkflow: (workflowId: number) => void;
  selectedClip: StudioClipResponse | null;
  aiContextMode: StudioAiContextMode;
  selectedClipTitle: string | null;
  aiWorkflowId: number | null;
  nodes: StudioWorkflowNodeResponse[];
  pendingInputThumbsByNodeId: ReadonlyMap<number, PendingNodeInputThumb[]>;
  aiModels: StudioAiModelListResponse | undefined;
  operationType: StudioAiOperationType;
  onOperationTypeChange: (type: StudioAiOperationType) => void;
  modelId: string;
  onModelIdChange: (id: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  generating: boolean;
  creatingClip: boolean;
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
  videoQuality: StudioVideoProviderQuality;
  onVideoQualityChange: (value: StudioVideoProviderQuality) => void;
  hasVideoInput: boolean;
  requireLogin: (action: () => void) => void;
  onBeforeClipFilterUpdate?: () => void;
  onTracksMutate: () => Promise<unknown>;
  onSubmit: () => void;
  onCreateClip: () => void;
  onApplyToClip: (outputId: number, mediaType: string, duration?: number) => void;
  onAddToTimeline: (outputId: number, mediaType: string, duration?: number) => void;
  onRetry: (nodeId: number) => Promise<void>;
}

export default function StudioLeftPanel({
  projectId,
  toolMode,
  placement,
  layoutToggleTitle,
  onTogglePlacement,
  workflows,
  activeWorkflowId,
  onNewWorkflow,
  onSelectWorkflow,
  selectedClip,
  aiContextMode,
  selectedClipTitle,
  aiWorkflowId,
  nodes,
  pendingInputThumbsByNodeId,
  aiModels,
  operationType,
  onOperationTypeChange,
  modelId,
  onModelIdChange,
  prompt,
  onPromptChange,
  generating,
  creatingClip,
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
  videoQuality,
  onVideoQualityChange,
  hasVideoInput,
  requireLogin,
  onBeforeClipFilterUpdate,
  onTracksMutate,
  onSubmit,
  onCreateClip,
  onApplyToClip,
  onAddToTimeline,
  onRetry,
}: StudioLeftPanelProps) {
  const { t } = useLanguage();

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-white/10 bg-background/80">
      {toolMode === "filters" ? (
        <StudioClipFilterPanel
          projectId={projectId}
          placement={placement}
          layoutToggleTitle={layoutToggleTitle}
          selectedClip={selectedClip}
          requireLogin={requireLogin}
          onBeforeUpdate={onBeforeClipFilterUpdate}
          onTogglePlacement={onTogglePlacement}
          onTracksMutate={onTracksMutate}
        />
      ) : toolMode === "local" ? (
        <>
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-foreground">{t("studioLocalAssetsTab")}</span>
            <StudioLayoutToggleButton
              placement={placement}
              onToggle={onTogglePlacement}
              title={layoutToggleTitle}
            />
          </header>
          <StudioLocalAssetsPanel projectId={projectId} />
        </>
      ) : toolMode === "workflows" ? (
        <>
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-foreground">{t("studioWorkflowList")}</span>
            <StudioLayoutToggleButton
              placement={placement}
              onToggle={onTogglePlacement}
              title={layoutToggleTitle}
            />
          </header>
          <section className="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              type="button"
              onClick={onNewWorkflow}
              className="mb-2 w-full cursor-pointer rounded-lg border border-dashed border-white/20 py-2 text-xs text-muted-foreground hover:border-primary/40"
            >
              + {t("studioWorkflowNew")}
            </button>
            {workflows.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelectWorkflow(w.id)}
                className={
                  "mb-1 w-full cursor-pointer rounded-lg px-2 py-2 text-left text-xs " +
                  (activeWorkflowId === w.id
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-white/5 text-foreground")
                }
              >
                {w.title || t("studioWorkflowFallback").replace("{id}", String(w.id))}
                <span className="ml-1 text-muted-foreground">({w.node_count})</span>
              </button>
            ))}
          </section>
        </>
      ) : toolMode === "ai" ? (
        <StudioAiPanel
          projectId={projectId}
          contextMode={aiContextMode}
          selectedClipTitle={selectedClipTitle}
          activeWorkflowId={aiWorkflowId}
          nodes={nodes}
          pendingInputThumbsByNodeId={pendingInputThumbsByNodeId}
          models={aiModels}
          operationType={operationType}
          onOperationTypeChange={onOperationTypeChange}
          modelId={modelId}
          onModelIdChange={onModelIdChange}
          prompt={prompt}
          onPromptChange={onPromptChange}
          generating={generating}
          creatingClip={creatingClip}
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
          videoQuality={videoQuality}
          onVideoQualityChange={onVideoQualityChange}
          hasVideoInput={hasVideoInput}
          onSubmit={onSubmit}
          onCreateClip={onCreateClip}
          onApplyToClip={onApplyToClip}
          onAddToTimeline={onAddToTimeline}
          onRetry={onRetry}
          placement={placement}
          layoutToggleTitle={layoutToggleTitle}
          onTogglePlacement={onTogglePlacement}
        />
      ) : null}
    </aside>
  );
}

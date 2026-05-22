"use client";

import { useCallback, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ingestDragPayloadToReferences } from "@/lib/studio/ai/ingestStudioAiDrag";
import { parseStudioAiDragData } from "@/lib/studio/ai/studioAiDrag";
import { getStudioAiComposerPlaceholder } from "@/lib/studio/ai/composerPlaceholders";
import type { StudioAiModelInfo, StudioAiModelListResponse } from "@/lib/studio/studioAiModels";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import { getModelsForOperationType } from "@/lib/studio/studioAiModels";
import type {
  StudioAiReference,
  StudioAspectRatio,
  StudioImageSize,
  StudioVideoMode,
} from "@/lib/studio/studioAiResources";
import StudioAiComposerToolbar from "./StudioAiComposerToolbar";
import StudioAiReferenceStrip from "./StudioAiReferenceStrip";

interface StudioAiComposerCardProps {
  operationType: StudioAiOperationType;
  onOperationTypeChange: (type: StudioAiOperationType) => void;
  models: StudioAiModelListResponse | undefined;
  modelId: string;
  onModelIdChange: (id: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  generating: boolean;
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
}

export default function StudioAiComposerCard({
  operationType,
  onOperationTypeChange,
  models,
  modelId,
  onModelIdChange,
  prompt,
  onPromptChange,
  generating,
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
}: StudioAiComposerCardProps) {
  const { t } = useLanguage();
  const [inputRowDragOver, setInputRowDragOver] = useState(false);

  const typeModels = getModelsForOperationType(models, operationType);
  const currentModel = typeModels.find((m) => m.id === modelId) as
    | StudioAiModelInfo
    | undefined;

  const placeholder = getStudioAiComposerPlaceholder(t, operationType, videoMode);
  const showStrip =
    operationType !== "video" || videoMode !== "text2video";

  const handleInputRowDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setInputRowDragOver(false);
      const payload = parseStudioAiDragData(e.dataTransfer);
      const result = ingestDragPayloadToReferences({
        payload,
        operationType,
        videoMode,
        references,
        onReferencesChange,
      });
      if (!result.success) {
        toast.error(t("studioAiDropWrongType"));
      }
    },
    [operationType, videoMode, references, onReferencesChange, t]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!generating && modelId && prompt.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 p-2.5 transition-colors">
      <div
        className={
          "flex gap-2 rounded-lg transition-colors " +
          (inputRowDragOver ? "ring-1 ring-primary/50" : "")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setInputRowDragOver(true);
        }}
        onDragLeave={() => setInputRowDragOver(false)}
        onDrop={handleInputRowDrop}
      >
        {showStrip ? (
          <StudioAiReferenceStrip
            operationType={operationType}
            videoMode={videoMode}
            references={references}
            onReferencesChange={onReferencesChange}
            showDragHighlight={false}
          />
        ) : null}
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={placeholder}
          className="min-h-[72px] min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-2 border-t border-white/10 pt-3">
        <StudioAiComposerToolbar
          operationType={operationType}
          onOperationTypeChange={onOperationTypeChange}
          modelId={modelId}
          onModelIdChange={onModelIdChange}
          typeModels={typeModels}
          currentModel={currentModel}
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
        />
      </div>

      <button
        type="button"
        disabled={generating || !modelId || !prompt.trim()}
        onClick={onSubmit}
        className="absolute bottom-3 right-3 flex h-9 w-9 min-h-[44px] min-w-[44px] 
        cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-white shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={t("studioAiSend")}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}

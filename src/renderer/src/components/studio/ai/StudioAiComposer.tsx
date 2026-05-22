"use client";

import type { StudioAiModelListResponse } from "@/lib/studio/studioAiModels";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import type {
  StudioAiReference,
  StudioAspectRatio,
  StudioImageSize,
  StudioVideoMode,
} from "@/lib/studio/studioAiResources";
import StudioAiComposerCard from "./StudioAiComposerCard";

interface StudioAiComposerProps {
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

export default function StudioAiComposer(props: StudioAiComposerProps) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-background/95 p-3">
      <StudioAiComposerCard {...props} />
    </div>
  );
}

"use client";

import { ImageIcon, Sparkles, Type, Video } from "lucide-react";
import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { StudioAiModelInfo } from "@/lib/studio/studioAiModels";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import {
  formatStudioModelOptionLabel,
  formatStudioModelPillLabel,
} from "@/lib/studio/studioAiModels";
import type {
  StudioAspectRatio,
  StudioImageSize,
  StudioVideoMode,
  StudioVideoProviderQuality,
} from "@/lib/studio/studioAiResources";
import {
  clampVideoProviderQuality,
  clampVideoDuration,
  getVideoProviderQualityOptions,
  isKelingV3OmniVideoGenerationModel,
  isSeedanceVideoGenerationModel,
} from "@/lib/studio/studioAiResources";
import StudioAiPillSelect, {
  type StudioAiPillSelectOption,
} from "@/components/studio/ai/StudioAiPillSelect";

interface StudioAiComposerToolbarProps {
  operationType: StudioAiOperationType;
  onOperationTypeChange: (type: StudioAiOperationType) => void;
  modelId: string;
  onModelIdChange: (id: string) => void;
  typeModels: StudioAiModelInfo[];
  currentModel: StudioAiModelInfo | undefined;
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
}

const VIDEO_ASPECTS: StudioAspectRatio[] = ["1:1", "16:9", "9:16", "adaptive"];

export default function StudioAiComposerToolbar({
  operationType,
  onOperationTypeChange,
  modelId,
  onModelIdChange,
  typeModels,
  currentModel,
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
}: StudioAiComposerToolbarProps) {
  const { t } = useLanguage();

  const typeOptions: StudioAiPillSelectOption[] = useMemo(
    () => [
      { value: "text", label: t("studioAiTypeText") },
      { value: "image", label: t("studioAiTypeImage") },
      { value: "video", label: t("studioAiTypeVideo") },
    ],
    [t]
  );

  const modelOptions: StudioAiPillSelectOption[] = useMemo(
    () =>
      typeModels.map((m) => {
        const full = formatStudioModelOptionLabel(m);
        return {
          value: m.id,
          label: full,
          pillLabel: formatStudioModelPillLabel(m),
          title: full,
        };
      }),
    [typeModels]
  );

  const videoModeOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const options: StudioAiPillSelectOption[] = [
      { value: "text2video", label: t("studioAiVideoModeText2Video") },
    ];
    if (isKelingV3OmniVideoGenerationModel(modelId)) {
      options.push({ value: "first_frame", label: t("studioAiVideoModeOmni") });
    }
    options.push({ value: "first_last_frame", label: t("studioAiVideoModeFirstLast") });
    return options;
  }, [modelId, t]);

  const imageAspectOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const aspects = currentModel?.supported_aspect_ratios ?? [
      "16:9",
      "1:1",
      "9:16",
    ];
    return aspects.map((a) => ({ value: a, label: a }));
  }, [currentModel]);

  const videoAspectOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const pool =
      currentModel?.supported_aspect_ratios?.filter((a) =>
        VIDEO_ASPECTS.includes(a as (typeof VIDEO_ASPECTS)[number])
      ) ?? VIDEO_ASPECTS;
    const allowed = pool.length > 0 ? pool : VIDEO_ASPECTS;
    return allowed.map((a) => ({ value: a, label: a }));
  }, [currentModel]);

  const sizeOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const sizes = currentModel?.supported_image_sizes ?? ["1K", "2K"];
    return sizes.map((s) => ({ value: s, label: s }));
  }, [currentModel]);

  const countOptions: StudioAiPillSelectOption[] = useMemo(
    () =>
      [1, 2, 3, 4].map((n) => ({
        value: String(n),
        label: `${n}`,
      })),
    []
  );

  const durationOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const min = isSeedanceVideoGenerationModel(modelId) ? 4 : 3;
    const max = hasVideoInput ? 10 : 15;
    const opts: StudioAiPillSelectOption[] = [];
    for (let d = min; d <= max; d += 1) {
      opts.push({ value: String(d), label: `${d}s` });
    }
    return opts;
  }, [hasVideoInput, modelId]);

  const videoQualityOptions: StudioAiPillSelectOption[] = useMemo(
    () => getVideoProviderQualityOptions(modelId),
    [modelId]
  );

  const selectedVideoQuality = clampVideoProviderQuality(modelId, videoQuality);

  const typeIcon =
    operationType === "text" ? (
      <Type className="h-3.5 w-3.5" />
    ) : operationType === "image" ? (
      <ImageIcon className="h-3.5 w-3.5" />
    ) : (
      <Video className="h-3.5 w-3.5" />
    );

  return (
    <div className="custom-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-2 pr-12 [scrollbar-color:rgba(139,92,246,0.4)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
      <StudioAiPillSelect
        value={operationType}
        onChange={(v) => onOperationTypeChange(v as StudioAiOperationType)}
        options={typeOptions}
        icon={typeIcon}
        className="max-w-[100px]"
      />
      <StudioAiPillSelect
        value={modelId}
        onChange={onModelIdChange}
        options={modelOptions}
        placeholder={t("studioAiSelectModel")}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        disabled={modelOptions.length === 0}
        className="min-w-[4.5rem] max-w-[9rem]"
      />
      {operationType === "video" ? (
        <StudioAiPillSelect
          value={videoMode}
          onChange={(v) => onVideoModeChange(v as StudioVideoMode)}
          options={videoModeOptions}
          className="max-w-[110px]"
        />
      ) : null}
      {operationType === "image" ? (
        <>
          <StudioAiPillSelect
            value={imageAspectRatio}
            onChange={(v) => onImageAspectRatioChange(v as StudioAspectRatio)}
            options={imageAspectOptions}
          />
          <StudioAiPillSelect
            value={imageSize}
            onChange={(v) => onImageSizeChange(v as StudioImageSize)}
            options={sizeOptions}
          />
          <StudioAiPillSelect
            value={String(generateCount)}
            onChange={(v) => onGenerateCountChange(Number(v))}
            options={countOptions}
          />
        </>
      ) : null}
      {operationType === "video" ? (
        <>
          <StudioAiPillSelect
            value={videoAspectRatio}
            onChange={(v) => onVideoAspectRatioChange(v as StudioAspectRatio)}
            options={videoAspectOptions}
          />
          <StudioAiPillSelect
            value={String(
              clampVideoDuration(
                videoDurationSec,
                hasVideoInput,
                currentModel?.supported_durations,
                modelId
              )
            )}
            onChange={(v) => onVideoDurationSecChange(Number(v))}
            options={durationOptions}
          />
          <StudioAiPillSelect
            value={selectedVideoQuality}
            onChange={(v) => onVideoQualityChange(v as StudioVideoProviderQuality)}
            options={videoQualityOptions}
          />
        </>
      ) : null}
    </div>
  );
}


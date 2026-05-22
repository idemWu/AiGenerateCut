"use client";

import { useMemo } from "react";
import { ImageIcon, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import StudioAiPillSelect, {
  type StudioAiPillSelectOption,
} from "@/components/studio/ai/StudioAiPillSelect";
import type { components } from "@/lib/api/schema";
import {
  findStudioModel,
  formatStudioModelOptionLabel,
  formatStudioModelPillLabel,
  type StudioAiModelInfo,
} from "@/lib/studio/studioAiModels";
import type { AssetImageGenerationFormState } from "@/lib/studio/assets/assetImageGenerationForm";
import type { StudioAssetType } from "@/lib/api/studio";
import StudioAssetReferenceUpload from "./StudioAssetReferenceUpload";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];
type StudioImageSize = components["schemas"]["StudioImageSize"];

interface StudioAssetFormFieldsProps {
  state: AssetImageGenerationFormState;
  onStateChange: (patch: Partial<AssetImageGenerationFormState>) => void;
  imageModels: StudioAiModelInfo[];
  showAssetType: boolean;
}

export default function StudioAssetFormFields({
  state,
  onStateChange,
  imageModels,
  showAssetType,
}: StudioAssetFormFieldsProps) {
  const { t } = useLanguage();

  const currentModel = useMemo(
    () => findStudioModel(imageModels, state.modelId),
    [imageModels, state.modelId]
  );

  const modelOptions: StudioAiPillSelectOption[] = useMemo(
    () =>
      imageModels.map((m) => {
        const full = formatStudioModelOptionLabel(m);
        return {
          value: m.id,
          label: full,
          pillLabel: formatStudioModelPillLabel(m),
          title: full,
        };
      }),
    [imageModels]
  );

  const aspectOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const aspects = currentModel?.supported_aspect_ratios ?? ["16:9", "1:1", "9:16"];
    return aspects.map((a) => ({ value: a, label: a }));
  }, [currentModel]);

  const sizeOptions: StudioAiPillSelectOption[] = useMemo(() => {
    const sizes = currentModel?.supported_image_sizes ?? ["1K", "2K", "4K"];
    return sizes.map((s) => ({ value: s, label: s }));
  }, [currentModel]);

  const countOptions: StudioAiPillSelectOption[] = useMemo(
    () => [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) })),
    []
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          {t("studioAssetName")}
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onStateChange({ name: e.target.value })}
          placeholder={t("studioAssetName")}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {showAssetType ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t("studioAssetTypeLabel")}
          </label>
          <select
            value={state.assetType}
            onChange={(e) =>
              onStateChange({ assetType: e.target.value as StudioAssetType })
            }
            className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="character">{t("studioAssetTypeCharacter")}</option>
            <option value="scene">{t("studioAssetTypeScene")}</option>
            <option value="prop">{t("studioAssetTypeProp")}</option>
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          {t("studioAiPlaceholderImage")}
        </label>
        <textarea
          value={state.prompt}
          onChange={(e) => onStateChange({ prompt: e.target.value })}
          rows={4}
          placeholder={t("studioAiPlaceholderImage")}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StudioAiPillSelect
          value={state.modelId}
          onChange={(v) => onStateChange({ modelId: v })}
          options={modelOptions}
          placeholder={t("studioAiSelectModel")}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          disabled={modelOptions.length === 0}
          className="min-w-[4.5rem] max-w-[9rem]"
        />
        <StudioAiPillSelect
          value={state.aspectRatio}
          onChange={(v) => onStateChange({ aspectRatio: v as StudioAspectRatio })}
          options={aspectOptions}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
        />
        <StudioAiPillSelect
          value={state.imageSize}
          onChange={(v) => onStateChange({ imageSize: v as StudioImageSize })}
          options={sizeOptions}
        />
        <StudioAiPillSelect
          value={String(state.generateCount)}
          onChange={(v) => onStateChange({ generateCount: Number(v) })}
          options={countOptions}
        />
      </div>

      <StudioAssetReferenceUpload
        label={t("studioAssetReferenceImages")}
        urls={state.referenceUrls}
        onUrlsChange={(referenceUrls) => onStateChange({ referenceUrls })}
      />
    </div>
  );
}

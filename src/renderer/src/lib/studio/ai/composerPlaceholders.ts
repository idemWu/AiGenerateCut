import type { TranslationKey } from "@/lib/i18n/translations";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import {
  isKelingV3OmniVideoGenerationModel,
  type StudioVideoMode,
} from "@/lib/studio/studioAiResources";

type TranslateFn = (key: TranslationKey) => string;

export function getStudioAiComposerPlaceholder(
  t: TranslateFn,
  operationType: StudioAiOperationType,
  videoMode: StudioVideoMode,
  modelId?: string | null
): string {
  if (operationType === "text") {
    return t("studioAiPlaceholderText");
  }
  if (operationType === "image") {
    return t("studioAiPlaceholderImage");
  }
  switch (videoMode) {
    case "text2video":
      return t("studioAiPlaceholderVideoText");
    case "first_frame":
      if (isKelingV3OmniVideoGenerationModel(modelId)) {
        return t("studioAiPlaceholderVideoOmni");
      }
      return t("studioAiPlaceholderVideoFirst");
    case "first_last_frame":
      return t("studioAiPlaceholderVideoFirstLast");
    default:
      return t("studioAiPlaceholder");
  }
}

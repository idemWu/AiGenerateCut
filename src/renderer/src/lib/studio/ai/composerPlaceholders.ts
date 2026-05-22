import type { TranslationKey } from "@/lib/i18n/translations";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import type { StudioVideoMode } from "@/lib/studio/studioAiResources";

type TranslateFn = (key: TranslationKey) => string;

export function getStudioAiComposerPlaceholder(
  t: TranslateFn,
  operationType: StudioAiOperationType,
  videoMode: StudioVideoMode
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
      return t("studioAiPlaceholderVideoFirst");
    case "first_last_frame":
      return t("studioAiPlaceholderVideoFirstLast");
    default:
      return t("studioAiPlaceholder");
  }
}

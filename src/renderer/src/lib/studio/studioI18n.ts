import type { TranslationKey } from "@/lib/i18n/translations";

type StudioTranslateFn = (key: TranslationKey) => string;

export function formatStudioStatusLabel(
  status: string | null | undefined,
  t: StudioTranslateFn
): string {
  switch (status) {
    case "pending":
      return t("studioStatusPending");
    case "processing":
      return t("studioStatusProcessing");
    case "succeeded":
      return t("studioStatusSucceeded");
    case "failed":
      return t("studioStatusFailed");
    default:
      return status ?? "";
  }
}

export function formatStudioOperationTypeLabel(
  operationType: string | null | undefined,
  t: StudioTranslateFn
): string {
  switch (operationType) {
    case "text":
      return t("studioAiTypeText");
    case "image":
      return t("studioAiTypeImage");
    case "video":
      return t("studioAiTypeVideo");
    default:
      return operationType ?? "";
  }
}

export function formatStudioAssetFallbackName(id: number, t: StudioTranslateFn): string {
  return t("studioAssetFallbackName").replace("{id}", String(id));
}

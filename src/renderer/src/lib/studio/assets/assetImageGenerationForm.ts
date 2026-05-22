import type {
  CreateStudioAssetGenerationRequest,
  CreateStudioAssetRequest,
  StudioAssetType,
} from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import type { StudioAiModelInfo } from "@/lib/studio/studioAiModels";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];
type StudioImageSize = components["schemas"]["StudioImageSize"];

export type AssetFormTab = "ai" | "upload" | "empty";

export interface AssetImageGenerationFormState {
  name: string;
  assetType: StudioAssetType;
  prompt: string;
  modelId: string;
  aspectRatio: StudioAspectRatio;
  imageSize: StudioImageSize;
  generateCount: number;
  referenceUrls: string[];
  uploadUrls: string[];
  selectedUploadUrl: string | null;
}

export function createDefaultAssetFormState(
  defaults: Partial<AssetImageGenerationFormState> = {}
): AssetImageGenerationFormState {
  return {
    name: "",
    assetType: "character",
    prompt: "",
    modelId: "",
    aspectRatio: "16:9",
    imageSize: "1K",
    generateCount: 1,
    referenceUrls: [],
    uploadUrls: [],
    selectedUploadUrl: null,
    ...defaults,
  };
}

export function assetFormFromAsset(
  asset: {
    name?: string | null;
    asset_type: StudioAssetType;
    prompt?: string | null;
    model?: string | null;
    reference_media_urls?: (string | null)[] | null;
  },
  defaults: { aspectRatio: StudioAspectRatio; imageSize: StudioImageSize }
): AssetImageGenerationFormState {
  const refs = (asset.reference_media_urls ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0
  );
  return createDefaultAssetFormState({
    name: asset.name?.trim() ?? "",
    assetType: asset.asset_type,
    prompt: asset.prompt?.trim() ?? "",
    modelId: asset.model?.trim() ?? "",
    aspectRatio: defaults.aspectRatio,
    imageSize: defaults.imageSize,
    referenceUrls: refs,
  });
}

export type AssetFormValidationErrorKey =
  | "studioAssetNameRequired"
  | "studioAiSelectModel"
  | "studioAssetPromptRequired"
  | "studioAssetUploadRequired";

export function validateAssetForm(
  state: AssetImageGenerationFormState,
  tab: AssetFormTab
): AssetFormValidationErrorKey | null {
  if (tab === "empty" || tab === "upload") {
    if (!state.name.trim()) return "studioAssetNameRequired";
    if (tab === "upload" && state.uploadUrls.length === 0) {
      return "studioAssetUploadRequired";
    }
    return null;
  }
  if (tab === "ai") {
    if (!state.name.trim()) return "studioAssetNameRequired";
    if (!state.prompt.trim()) return "studioAssetPromptRequired";
    if (!state.modelId) return "studioAiSelectModel";
    return null;
  }
  return null;
}

export function clampAssetImageSize(
  imageSize: StudioImageSize,
  model: StudioAiModelInfo | undefined
): StudioImageSize {
  const supported = model?.supported_image_sizes;
  if (!supported?.length) return imageSize;
  if (supported.includes(imageSize)) return imageSize;
  return supported[0]!;
}

export function clampAssetAspectRatio(
  aspectRatio: StudioAspectRatio,
  model: StudioAiModelInfo | undefined
): StudioAspectRatio {
  const supported = model?.supported_aspect_ratios;
  if (!supported?.length) return aspectRatio;
  if (supported.includes(aspectRatio)) return aspectRatio;
  return supported[0] as StudioAspectRatio;
}

export interface BuildCreateAssetBodyOptions {
  parentId?: number | null;
  tab: AssetFormTab;
}

export function buildCreateAssetBody(
  state: AssetImageGenerationFormState,
  options: BuildCreateAssetBodyOptions
): CreateStudioAssetRequest {
  const name = state.name.trim();
  const base: CreateStudioAssetRequest = {
    generate_count: state.generateCount,
  };

  if (options.parentId != null) {
    base.parent_id = options.parentId;
  } else {
    base.asset_type = state.assetType;
  }

  if (name) {
    base.name = name;
  }

  if (options.tab === "upload" && state.uploadUrls.length > 0) {
    base.image_urls = [...state.uploadUrls];
    base.selected_image_url =
      state.selectedUploadUrl ?? state.uploadUrls[0] ?? null;
    return base;
  }

  if (options.tab === "empty") {
    return base;
  }

  if (options.tab === "ai") {
    base.prompt = state.prompt.trim();
    base.model = state.modelId;
    base.aspect_ratio = state.aspectRatio;
    base.image_size = state.imageSize;
    base.generate_count = state.generateCount;
    if (state.referenceUrls.length > 0) {
      base.reference_media_urls = [...state.referenceUrls];
    }
  }

  return base;
}

export function buildGenerationBody(
  state: AssetImageGenerationFormState
): CreateStudioAssetGenerationRequest {
  const body: CreateStudioAssetGenerationRequest = {
    prompt: state.prompt.trim(),
    model: state.modelId,
    aspect_ratio: state.aspectRatio,
    image_size: state.imageSize,
    generate_count: state.generateCount,
  };
  if (state.referenceUrls.length > 0) {
    body.reference_media_urls = [...state.referenceUrls];
  }
  return body;
}

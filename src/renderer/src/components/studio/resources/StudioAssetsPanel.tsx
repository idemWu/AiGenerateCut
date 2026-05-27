"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  deleteStudioAsset,
  deleteStudioAssetHistory,
  retryStudioAssetGeneration,
  selectStudioAssetCurrentImage,
  type StudioAiModelListResponse,
  type StudioAspectRatio,
  type StudioAssetResponse,
  type StudioAssetType,
} from "@/lib/api/studio";
import { useStudioAssets, useStudioAssetVariants } from "@/lib/hooks/useStudio";
import { useStudioAssetHistories } from "@/lib/hooks/useStudioAssetHistories";
import { useRequireLogin } from "@/lib/hooks/useRequireLogin";
import { isStudioRequestTimeout } from "@/lib/studio/ai/runStudioNodeGeneration";
import {
  assetFormFromAsset,
  clampAssetAspectRatio,
  clampAssetImageSize,
  createDefaultAssetFormState,
  validateAssetForm,
  type AssetImageGenerationFormState,
} from "@/lib/studio/assets/assetImageGenerationForm";
import { submitAssetCreate, submitAssetGeneration } from "@/lib/studio/assets/submitAssetForm";
import { runAssetGenerationAfterCreate } from "@/lib/studio/assets/pollAssetHistory";
import { getModelsForOperationType } from "@/lib/studio/studioAiModels";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import { setStudioAiDragData } from "@/lib/studio/ai/studioAiDrag";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import {
  formatStudioAssetFallbackName,
  formatStudioStatusLabel,
} from "@/lib/studio/studioI18n";
import StudioAssetFormFields from "./StudioAssetFormFields";

type AssetPanelView =
  | { level: "list" }
  | { level: "create"; parentId?: number; regenerateAssetId?: number }
  | { level: "variants"; parentAssetId: number }
  | {
      level: "versions";
      assetId: number;
      assetName: string;
      parentAssetId: number;
    };

interface StudioAssetsPanelProps {
  projectId: number;
  aspectRatio: StudioAspectRatio;
  aiModels: StudioAiModelListResponse | undefined;
  onAssetsMutate: () => Promise<unknown>;
}

type AssetTypeFilter = StudioAssetType | "all";

const TYPE_FILTERS: AssetTypeFilter[] = ["all", "character", "scene", "prop", "style"];

export default function StudioAssetsPanel({
  projectId,
  aspectRatio,
  aiModels,
  onAssetsMutate,
}: StudioAssetsPanelProps) {
  const { t } = useLanguage();
  const requireLogin = useRequireLogin();
  const [view, setView] = useState<AssetPanelView>({ level: "list" });
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");
  const [highlightAssetId, setHighlightAssetId] = useState<number | null>(null);

  const assetTypeParam = typeFilter === "all" ? null : typeFilter;

  const variantsParentId =
    view.level === "variants"
      ? view.parentAssetId
      : view.level === "versions"
        ? view.parentAssetId
        : null;

  const { assets, mutate: mutateAssets } = useStudioAssets(projectId, assetTypeParam, {
    refreshInterval: 2500,
  });

  const displayAssets = assets;
  const refreshAssetList = useCallback(async () => {
    await mutateAssets();
    await onAssetsMutate();
  }, [mutateAssets, onAssetsMutate]);

  const { variants, mutate: mutateVariants } = useStudioAssetVariants(
    projectId,
    variantsParentId
  );

  const versionsAssetId = view.level === "versions" ? view.assetId : null;
  const versionsAsset = useMemo(() => {
    if (versionsAssetId == null) return null;
    const fromList = displayAssets.find((a) => a.id === versionsAssetId);
    if (fromList) return fromList;
    return variants.find((v) => v.id === versionsAssetId) ?? null;
  }, [displayAssets, variants, versionsAssetId]);

  const isVersionsProcessing = versionsAsset?.status === "processing";
  const { histories, mutate: mutateHistories } = useStudioAssetHistories(
    projectId,
    versionsAssetId,
    { refreshInterval: isVersionsProcessing ? 2500 : undefined }
  );

  const refreshVariants = useCallback(async () => {
    if (variantsParentId != null) {
      await mutateVariants();
    }
    await refreshAssetList();
  }, [mutateVariants, refreshAssetList, variantsParentId]);

  const imageModels = useMemo(
    () => getModelsForOperationType(aiModels, "image"),
    [aiModels]
  );

  const parentAsset = useMemo(() => {
    if (view.level === "variants") {
      return displayAssets.find((a) => a.id === view.parentAssetId) ?? null;
    }
    if (view.level === "versions") {
      return displayAssets.find((a) => a.id === view.parentAssetId) ?? null;
    }
    return null;
  }, [displayAssets, view]);

  const variantItems = useMemo(() => {
    if (!parentAsset) return [];
    return [parentAsset, ...variants.filter((v) => v.id !== parentAsset.id)];
  }, [parentAsset, variants]);

  const typeLabel = (type: AssetTypeFilter): string => {
    if (type === "all") return t("studioAssetTypeAll");
    if (type === "character") return t("studioAssetTypeCharacter");
    if (type === "scene") return t("studioAssetTypeScene");
    if (type === "prop") return t("studioAssetTypeProp");
    return t("studioAssetTypeStyle");
  };

  const handleDeleteAsset = useCallback(
    async (assetId: number) => {
      if (!window.confirm(t("studioAssetDeleteConfirm"))) return;
      try {
        await deleteStudioAsset(projectId, assetId);
        await refreshVariants();
        setView({ level: "list" });
        toast.success(t("studioAssetCreateSuccess"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
      }
    },
    [projectId, refreshVariants, t]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        view={view}
        onBack={() => {
          if (view.level === "versions") {
            setView({ level: "variants", parentAssetId: view.parentAssetId });
          } else if (view.level === "variants" || view.level === "create") {
            setView({ level: "list" });
          }
        }}
        onAdd={() =>
          requireLogin(() => {
            if (view.level === "variants") {
              setView({ level: "create", parentId: view.parentAssetId });
            } else {
              setView({ level: "create" });
            }
          })
        }
        showTypeFilters={view.level === "list"}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        typeLabel={typeLabel}
        t={t}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {view.level === "list" ? (
          <>
            <p className="mb-2 text-[10px] text-muted-foreground">
              {t("studioAssetDoubleClickHint")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {displayAssets.map((asset) => (
                <AssetThumbCard
                  key={asset.id}
                  asset={asset}
                  highlighted={highlightAssetId === asset.id}
                  onOpen={() =>
                    setView({ level: "variants", parentAssetId: asset.id })
                  }
                />
              ))}
            </div>
          </>
        ) : null}

        {view.level === "create" ? (
          <AssetCreateView
            projectId={projectId}
            aspectRatio={aspectRatio}
            imageModels={imageModels}
            parentId={view.parentId}
            regenerateAssetId={view.regenerateAssetId}
            assets={displayAssets}
            variants={variants}
            refreshAssets={refreshAssetList}
            refreshVariants={refreshVariants}
            onDone={(assetId) => {
              setHighlightAssetId(assetId);
              if (view.parentId != null) {
                setView({ level: "variants", parentAssetId: view.parentId });
              } else {
                setView({ level: "list" });
              }
            }}
            onCancel={() => {
              if (view.parentId != null) {
                setView({ level: "variants", parentAssetId: view.parentId });
              } else {
                setView({ level: "list" });
              }
            }}
            t={t}
          />
        ) : null}

        {view.level === "variants" && parentAsset ? (
          <AssetVariantsView
            parentAsset={parentAsset}
            variants={variantItems}
            onOpenVariant={(v) =>
              setView({
                level: "versions",
                assetId: v.id,
                assetName: v.name ?? `#${v.id}`,
                parentAssetId: view.parentAssetId,
              })
            }
            onRegenerate={(assetId) =>
              requireLogin(() =>
                setView({
                  level: "create",
                  parentId: view.parentAssetId,
                  regenerateAssetId: assetId,
                })
              )
            }
            onDelete={() => void handleDeleteAsset(parentAsset.id)}
            t={t}
          />
        ) : null}

        {view.level === "versions" && versionsAsset ? (
          <AssetVersionsView
            asset={versionsAsset}
            histories={histories}
            onRegenerate={() =>
              requireLogin(() =>
                setView({
                  level: "create",
                  parentId: view.parentAssetId,
                  regenerateAssetId: view.assetId,
                })
              )
            }
            onSelectImage={async (historyId, imageUrl) => {
              try {
                await selectStudioAssetCurrentImage(projectId, view.assetId, {
                  history_id: historyId,
                  image_url: imageUrl,
                });
                await refreshVariants();
                toast.success(t("studioAssetSelectImage"));
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : t("studioTimelineSaveFailed")
                );
              }
            }}
            onRetry={async (historyId) => {
              try {
                const history = await retryStudioAssetGeneration(
                  projectId,
                  view.assetId,
                  historyId
                );
                await mutateHistories();
                runAssetGenerationAfterCreate({
                  projectId,
                  assetId: view.assetId,
                  history,
                  refreshHistories: () => mutateHistories(),
                  refreshAssets: refreshVariants,
                  t,
                });
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : t("studioTimelineSaveFailed")
                );
              }
            }}
            onDeleteHistory={async (historyId) => {
              if (!window.confirm(t("studioAssetDeleteHistoryConfirm"))) return;
              try {
                await deleteStudioAssetHistory(projectId, view.assetId, historyId);
                await mutateHistories();
                await refreshVariants();
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : t("studioTimelineSaveFailed")
                );
              }
            }}
            t={t}
          />
        ) : null}
      </div>
    </div>
  );
}

function PanelHeader({
  view,
  onBack,
  onAdd,
  showTypeFilters,
  typeFilter,
  onTypeFilterChange,
  typeLabel,
  t,
}: {
  view: AssetPanelView;
  onBack: () => void;
  onAdd: () => void;
  showTypeFilters: boolean;
  typeFilter: AssetTypeFilter;
  onTypeFilterChange: (v: AssetTypeFilter) => void;
  typeLabel: (type: AssetTypeFilter) => string;
  t: (key: TranslationKey) => string;
}) {
  const breadcrumb =
    view.level === "list"
      ? t("studioAssetBreadcrumbList")
      : view.level === "variants"
        ? t("studioAssetBreadcrumbVariants")
        : view.level === "versions"
          ? t("studioAssetBreadcrumbVersions")
          : view.level === "create"
            ? view.regenerateAssetId != null
              ? t("studioAssetRegenerate")
              : t("studioAddAsset")
            : t("studioAssetBreadcrumbList");

  return (
    <header className="shrink-0 space-y-2 border-b border-white/10 p-2">
      <div className="flex items-center gap-2">
        {view.level !== "list" ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("studioAssetBack")}
          </button>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {breadcrumb}
        </span>
        {view.level !== "create" ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex cursor-pointer items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-foreground hover:border-primary/40"
          >
            <Plus className="h-3 w-3" />
            {view.level === "variants" ? t("studioAssetAddVariant") : t("studioAddAsset")}
          </button>
        ) : null}
      </div>
      {showTypeFilters ? (
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeFilterChange(type)}
              className={
                "cursor-pointer rounded-md px-2 py-0.5 text-[10px] " +
                (typeFilter === type
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-white/5")
              }
            >
              {typeLabel(type)}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function AssetThumbCard({
  asset,
  highlighted,
  onOpen,
}: {
  asset: StudioAssetResponse;
  highlighted: boolean;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  const thumbUrl = resolveStudioMediaUrl(asset.image_url) ?? asset.image_url ?? "";
  const isProcessing = asset.status === "processing";

  return (
    <button
      type="button"
      onDoubleClick={onOpen}
      draggable={!!thumbUrl}
      onDragStart={(e) => {
        if (!thumbUrl) return;
        setStudioAiDragData(e.dataTransfer, {
          source: {
            kind: "asset",
            id: asset.id,
            resourceId: asset.resource_id ?? asset.current_image_resource_id,
            currentVersionId: asset.current_version_id ?? asset.current_history_id,
          },
          label: asset.name ?? formatStudioAssetFallbackName(asset.id, t),
          thumbUrl,
        });
      }}
      className={
        "relative cursor-pointer overflow-hidden rounded-md text-left ring-1 transition " +
        (highlighted ? "ring-accent ring-2" : "ring-white/10 hover:ring-primary/40")
      }
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="aspect-square w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-white/5 text-[10px] text-muted-foreground">
          —
        </div>
      )}
      {isProcessing ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </span>
      ) : null}
      <p className="truncate px-1 py-0.5 text-[10px] text-foreground" title={asset.name ?? ""}>
        {asset.name ?? `#${asset.id}`}
      </p>
      {isProcessing ? (
        <span className="absolute left-1 top-1 rounded bg-accent/90 px-1 py-px text-[8px] text-white">
          {t("studioAssetProcessing")}
        </span>
      ) : null}
      {(asset.children_count ?? 0) > 0 ? (
        <span className="absolute bottom-6 right-1 rounded bg-black/60 px-1 py-px text-[8px] text-white">
          {t("studioAssetVariantCount").replace("{count}", String(asset.children_count))}
        </span>
      ) : null}
    </button>
  );
}

interface AssetCreateViewProps {
  projectId: number;
  aspectRatio: StudioAspectRatio;
  imageModels: ReturnType<typeof getModelsForOperationType>;
  parentId?: number;
  regenerateAssetId?: number;
  assets: StudioAssetResponse[];
  variants: StudioAssetResponse[];
  refreshAssets: () => Promise<unknown>;
  refreshVariants: () => Promise<unknown>;
  onDone: (assetId: number) => void;
  onCancel: () => void;
  t: (key: TranslationKey) => string;
}

function AssetCreateView({
  projectId,
  aspectRatio,
  imageModels,
  parentId,
  regenerateAssetId,
  assets,
  variants,
  refreshAssets,
  refreshVariants,
  onDone,
  onCancel,
  t,
}: AssetCreateViewProps) {
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<AssetImageGenerationFormState>(() =>
    createDefaultAssetFormState({
      aspectRatio,
      imageSize: "1K",
      modelId: imageModels[0]?.id ?? "",
      assetType: "character",
    })
  );

  const regenerateTarget = useMemo(() => {
    if (regenerateAssetId == null) return null;
    return (
      assets.find((a) => a.id === regenerateAssetId) ??
      variants.find((v) => v.id === regenerateAssetId) ??
      null
    );
  }, [assets, regenerateAssetId, variants]);

  useEffect(() => {
    if (regenerateTarget) {
      setFormState(
        assetFormFromAsset(regenerateTarget, { aspectRatio, imageSize: "1K" })
      );
      return;
    }
    const inherited = parentId
      ? (assets.find((a) => a.id === parentId)?.asset_type ?? "character")
      : "character";
    setFormState(
      createDefaultAssetFormState({
        aspectRatio,
        imageSize: "1K",
        assetType: inherited,
        modelId: imageModels[0]?.id ?? "",
      })
    );
  }, [aspectRatio, assets, imageModels, parentId, regenerateTarget]);

  useEffect(() => {
    if (imageModels.length === 0) return;
    if (!formState.modelId || !imageModels.some((m) => m.id === formState.modelId)) {
      setFormState((prev) => ({ ...prev, modelId: imageModels[0]!.id }));
    }
  }, [formState.modelId, imageModels]);

  const currentModel = imageModels.find((m) => m.id === formState.modelId);
  useEffect(() => {
    if (!currentModel) return;
    setFormState((prev) => ({
      ...prev,
      imageSize: clampAssetImageSize(prev.imageSize, currentModel),
      aspectRatio: clampAssetAspectRatio(prev.aspectRatio, currentModel),
    }));
  }, [currentModel?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateAssetForm(formState, "ai");
    if (validationError) {
      toast.error(t(validationError));
      return;
    }

    setLoading(true);
    try {
      if (regenerateAssetId != null) {
        await submitAssetGeneration({
          projectId,
          assetId: regenerateAssetId,
          state: formState,
          refreshAssets: refreshVariants,
          refreshHistories: refreshVariants,
          t,
        });
        toast.success(t("studioAssetGenerateStarted"));
        onDone(regenerateAssetId);
        return;
      }

      const asset = await submitAssetCreate({
        projectId,
        state: formState,
        parentId: parentId ?? null,
        refreshAssets,
        refreshHistories: async () => refreshVariants(),
        t,
      });
      toast.success(t("studioAssetGenerateStarted"));
      onDone(asset.id);
    } catch (err) {
      if (isStudioRequestTimeout(err)) {
        await refreshAssets();
        toast.message(t("studioAiGenerationStillRunning"));
        if (regenerateAssetId != null) {
          onDone(regenerateAssetId);
        } else if (parentId != null) {
          onDone(parentId);
        } else {
          onCancel();
        }
        return;
      }
      toast.error(err instanceof Error ? err.message : t("studioTimelineSaveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <StudioAssetFormFields
        state={formState}
        onStateChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
        imageModels={imageModels}
        showAssetType={parentId == null && regenerateAssetId == null}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-foreground"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("studioAssetGenerate")}
        </button>
      </div>
    </form>
  );
}

function AssetVariantsView({
  parentAsset,
  variants,
  onOpenVariant,
  onRegenerate,
  onDelete,
  t,
}: {
  parentAsset: StudioAssetResponse;
  variants: StudioAssetResponse[];
  onOpenVariant: (asset: StudioAssetResponse) => void;
  onRegenerate: (assetId: number) => void;
  onDelete: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <p className="mb-1 text-xs font-medium text-foreground">{parentAsset.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {t("studioAssetVariantCount").replace("{count}", String(Math.max(0, variants.length - 1)))}
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("studioAssetDoubleClickHint")}</p>
      <div className="grid grid-cols-2 gap-2">
        {variants.map((v) => (
          <VariantThumbCard
            key={v.id}
            asset={v}
            isParent={v.id === parentAsset.id}
            onOpen={() => onOpenVariant(v)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onRegenerate(parentAsset.id)}
          className="cursor-pointer rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-[10px] text-white"
        >
          {t("studioAssetRegenerate")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          {t("studioAssetDelete")}
        </button>
      </div>
    </div>
  );
}

function VariantThumbCard({
  asset,
  isParent,
  onOpen,
}: {
  asset: StudioAssetResponse;
  isParent: boolean;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  const thumbUrl = resolveStudioMediaUrl(asset.image_url) ?? asset.image_url ?? "";
  const isProcessing = asset.status === "processing";

  return (
    <button
      type="button"
      onDoubleClick={onOpen}
      draggable={!!thumbUrl}
      onDragStart={(e) => {
        if (!thumbUrl) return;
        setStudioAiDragData(e.dataTransfer, {
          source: {
            kind: "asset",
            id: asset.id,
            resourceId: asset.resource_id ?? asset.current_image_resource_id,
            currentVersionId: asset.current_version_id ?? asset.current_history_id,
          },
          label: asset.name ?? formatStudioAssetFallbackName(asset.id, t),
          thumbUrl,
        });
      }}
      className="relative cursor-pointer overflow-hidden rounded-md text-left ring-1 ring-white/10 hover:ring-primary/40"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="aspect-square w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-white/5 text-[10px] text-muted-foreground">
          —
        </div>
      )}
      {isProcessing ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </span>
      ) : null}
      <p className="truncate px-1 py-0.5 text-[10px]">{asset.name ?? `#${asset.id}`}</p>
      {isParent ? (
        <span className="absolute left-1 top-1 rounded bg-primary/80 px-1 text-[8px] text-white">
          {t("studioAssetBreadcrumbList")}
        </span>
      ) : null}
    </button>
  );
}

function AssetVersionsView({
  asset,
  histories,
  onRegenerate,
  onSelectImage,
  onRetry,
  onDeleteHistory,
  t,
}: {
  asset: StudioAssetResponse;
  histories: import("@/lib/api/studio").StudioAssetHistoryResponse[];
  onRegenerate: () => void;
  onSelectImage: (historyId: number, imageUrl: string) => void;
  onRetry: (historyId: number) => void;
  onDeleteHistory: (historyId: number) => void;
  t: (key: TranslationKey) => string;
}) {
  const thumbUrl = resolveStudioMediaUrl(asset.image_url) ?? asset.image_url ?? "";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {t("studioAssetVersionCount").replace("{count}", String(histories.length))}
          </p>
          {asset.status === "processing" ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("studioAssetProcessing")}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-primary to-accent py-2 text-xs font-medium text-white"
      >
        {t("studioAssetRegenerate")}
      </button>
      {!thumbUrl && histories.some((h) => h.status === "succeeded") ? (
        <p className="text-[10px] text-accent">{t("studioAssetPickImageHint")}</p>
      ) : null}
      <div className="space-y-3">
        {histories.map((h) => (
          <HistoryBatchCard
            key={h.id}
            history={h}
            onSelectImage={onSelectImage}
            onRetry={onRetry}
            onDelete={onDeleteHistory}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryBatchCard({
  history,
  onSelectImage,
  onRetry,
  onDelete,
  t,
}: {
  history: import("@/lib/api/studio").StudioAssetHistoryResponse;
  onSelectImage: (historyId: number, imageUrl: string) => void;
  onRetry: (historyId: number) => void;
  onDelete: (historyId: number) => void;
  t: (key: TranslationKey) => string;
}) {
  const isPending = history.status === "pending" || history.status === "processing";
  const statusLabel = formatStudioStatusLabel(history.status, t);
  const urls = (history.image_urls ?? [])
    .map((u) => resolveStudioMediaUrl(u) ?? u)
    .filter((u): u is string => !!u);

  return (
    <article className="rounded-lg border border-white/10 bg-white/5 p-2">
      <header className="mb-2 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : null}
          {statusLabel}
          <span className="text-foreground/60">
            · {new Date(history.created_at).toLocaleString()}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onDelete(history.id)}
          className="cursor-pointer text-destructive hover:underline"
        >
          {t("studioAssetDeleteHistory")}
        </button>
      </header>
      {history.prompt ? (
        <p className="mb-2 line-clamp-2 text-[10px] text-foreground/80">{history.prompt}</p>
      ) : null}
      {history.status === "failed" ? (
        <div className="mb-2 space-y-1">
          {history.error_message ? (
            <p className="text-[10px] text-destructive">{history.error_message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => onRetry(history.id)}
            className="cursor-pointer text-[10px] text-accent hover:underline"
          >
            {t("studioRetry")}
          </button>
        </div>
      ) : null}
      {urls.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {urls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onSelectImage(history.id, url)}
              className="cursor-pointer overflow-hidden rounded-md ring-1 ring-white/10 hover:ring-primary/50"
              title={t("studioAssetSelectImage")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

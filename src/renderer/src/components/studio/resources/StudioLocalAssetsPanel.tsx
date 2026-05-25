"use client";

import { AlertTriangle, FolderOpen, ImageIcon, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import { useLocalAssets } from "@/lib/studio/localAssets/useLocalAssets";
import { setLocalAssetDragData } from "@/lib/studio/localAssets/localAssetDrag";
import { localAssetProtocolUrl } from "@/lib/studio/localAssets/localAssetUrl";
import type { LocalAsset } from "@/lib/studio/localAssets/types";

interface StudioLocalAssetsPanelProps {
  projectId: number;
}

function formatDuration(seconds: number | undefined): string | null {
  if (!Number.isFinite(seconds) || seconds == null) return null;
  const total = Math.max(0, Math.round(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export default function StudioLocalAssetsPanel({ projectId }: StudioLocalAssetsPanelProps) {
  const { t } = useLanguage();
  const { folderPath, assets, isLoading, selectingFolder, pickFolder } =
    useLocalAssets(projectId);

  const handlePickFolder = async () => {
    try {
      await pickFolder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("studioTimelineSaveFailed"));
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 space-y-2 border-b border-white/10 p-2">
        <button
          type="button"
          disabled={selectingFolder}
          onClick={() => void handlePickFolder()}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectingFolder ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          {folderPath ? t("studioLocalAssetsChangeFolder") : t("studioLocalAssetsLinkFolder")}
        </button>
        {folderPath ? (
          <p className="truncate text-[10px] text-muted-foreground" title={folderPath}>
            {t("studioLocalAssetsFolder")}: {folderPath}
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-4 text-center">
            <p className="text-xs font-medium text-foreground">
              {t("studioLocalAssetsEmptyTitle")}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("studioLocalAssetsEmptyDesc")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <LocalAssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LocalAssetCard({ asset }: { asset: LocalAsset }) {
  const { t } = useLanguage();
  const duration = formatDuration(asset.durationSec);
  const url = localAssetProtocolUrl(asset.id);

  return (
    <button
      type="button"
      draggable={asset.exists}
      disabled={!asset.exists}
      onDragStart={(e) => {
        if (!asset.exists) return;
        setLocalAssetDragData(e.dataTransfer, {
          assetId: asset.id,
          name: asset.name,
          mediaType: asset.mediaType,
          durationSec: asset.durationSec,
        });
      }}
      title={asset.exists ? t("studioLocalAssetsDragHint") : t("studioLocalAssetsMissing")}
      className={
        "relative overflow-hidden rounded-md text-left ring-1 transition " +
        (asset.exists
          ? "cursor-grab ring-white/10 hover:ring-primary/40 active:cursor-grabbing"
          : "cursor-not-allowed opacity-50 ring-destructive/50")
      }
    >
      <div className="relative aspect-square w-full bg-white/5">
        {asset.exists && asset.mediaType === "image" ? (
          <img
            src={url}
            alt=""
            crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : asset.exists && asset.mediaType === "video" ? (
          <video
            src={url}
            crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
            preload="metadata"
            muted
            playsInline
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-px text-[8px] text-white">
          {asset.mediaType === "video" ? (
            <Video className="inline h-3 w-3" />
          ) : (
            <ImageIcon className="inline h-3 w-3" />
          )}
        </span>
        {duration ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px text-[8px] text-white">
            {duration}
          </span>
        ) : null}
        {!asset.exists ? (
          <span className="absolute inset-x-1 bottom-1 rounded bg-destructive/90 px-1 py-px text-center text-[8px] text-white">
            {t("studioLocalAssetsMissing")}
          </span>
        ) : null}
      </div>
      <p className="truncate px-1 py-0.5 text-[10px] text-foreground" title={asset.relativePath}>
        {asset.name}
      </p>
    </button>
  );
}

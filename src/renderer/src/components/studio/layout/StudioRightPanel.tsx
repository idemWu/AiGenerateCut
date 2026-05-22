"use client";

import StudioLayoutToggleButton from "@/components/studio/layout/StudioLayoutToggleButton";
import StudioAssetsPanel from "@/components/studio/resources/StudioAssetsPanel";
import StudioClipPropertiesPanel from "@/components/studio/resources/StudioClipPropertiesPanel";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type {
  StudioAiModelListResponse,
  StudioClipResponse,
  StudioKeyframeResponse,
} from "@/lib/api/studio";
import { setStudioAiDragData } from "@/lib/studio/ai/studioAiDrag";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import type { components } from "@/lib/api/schema";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];
export type StudioResourceTab = "keyframes" | "assets" | "properties";

interface StudioRightPanelProps {
  placement: StudioPanelPlacement;
  layoutToggleTitle: string;
  onTogglePlacement: () => void;
  resourceTab: StudioResourceTab;
  onResourceTabChange: (tab: StudioResourceTab) => void;
  projectId: number;
  aspectRatio: StudioAspectRatio;
  aiModels: StudioAiModelListResponse | undefined;
  keyframes: StudioKeyframeResponse[];
  selectedClip: StudioClipResponse | null;
  requireLogin: (action: () => void) => void;
  onAssetsMutate: () => Promise<unknown>;
  onBeforeClipPropertyUpdate?: () => void;
  onTracksMutate: () => Promise<unknown>;
}

export default function StudioRightPanel({
  placement,
  layoutToggleTitle,
  onTogglePlacement,
  resourceTab,
  onResourceTabChange,
  projectId,
  aspectRatio,
  aiModels,
  keyframes,
  selectedClip,
  requireLogin,
  onAssetsMutate,
  onBeforeClipPropertyUpdate,
  onTracksMutate,
}: StudioRightPanelProps) {
  const { t } = useLanguage();

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-white/10">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-medium">{t("studioResources")}</span>
        <StudioLayoutToggleButton
          placement={placement}
          onToggle={onTogglePlacement}
          title={layoutToggleTitle}
        />
      </header>
      <section className="flex shrink-0 gap-1 border-b border-white/10 p-2">
        <button
          type="button"
          onClick={() => onResourceTabChange("keyframes")}
          className={
            "flex-1 cursor-pointer rounded py-1 text-xs " +
            (resourceTab === "keyframes" ? "bg-primary/20 text-primary" : "")
          }
        >
          {t("studioImageKeyframe")}
        </button>
        <button
          type="button"
          onClick={() => onResourceTabChange("assets")}
          className={
            "flex-1 cursor-pointer rounded py-1 text-xs " +
            (resourceTab === "assets" ? "bg-primary/20 text-primary" : "")
          }
        >
          {t("studioAssetsTab")}
        </button>
        <button
          type="button"
          onClick={() => onResourceTabChange("properties")}
          className={
            "flex-1 cursor-pointer rounded py-1 text-xs " +
            (resourceTab === "properties" ? "bg-primary/20 text-primary" : "")
          }
        >
          {t("studioPropertiesTab")}
        </button>
      </section>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {resourceTab === "keyframes" ? (
          <section className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-2">
              {keyframes.map((kf) => (
                <DraggableResourceThumb
                  key={kf.id}
                  thumbUrl={kf.image_url ?? ""}
                  label={`KF #${kf.id}`}
                  onDragStart={(e) => {
                    setStudioAiDragData(e.dataTransfer, {
                      source: { kind: "keyframe", id: kf.id },
                      label: `KF #${kf.id}`,
                      thumbUrl: kf.image_url,
                    });
                  }}
                />
              ))}
            </div>
          </section>
        ) : resourceTab === "assets" ? (
          <StudioAssetsPanel
            projectId={projectId}
            aspectRatio={aspectRatio}
            aiModels={aiModels}
            onAssetsMutate={onAssetsMutate}
          />
        ) : (
          <section className="min-h-0 flex-1 overflow-y-auto">
            <StudioClipPropertiesPanel
              projectId={projectId}
              selectedClip={selectedClip}
              requireLogin={requireLogin}
              onBeforeUpdate={onBeforeClipPropertyUpdate}
              onTracksMutate={onTracksMutate}
            />
          </section>
        )}
      </section>
    </aside>
  );
}

function DraggableResourceThumb({
  thumbUrl,
  label,
  onDragStart,
}: {
  thumbUrl: string;
  label: string;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      draggable={!!thumbUrl}
      onDragStart={onDragStart}
      title={t("studioAiDragHint")}
      className="cursor-grab active:cursor-grabbing"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={label}
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="aspect-square rounded-md object-cover ring-1 ring-white/10 transition hover:ring-primary/40"
          draggable={false}
        />
      ) : (
        <div className="flex aspect-square items-center justify-center rounded-md bg-white/5 text-[10px] text-muted-foreground ring-1 ring-white/10">
          —
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import StudioLayoutToggleButton from "@/components/studio/layout/StudioLayoutToggleButton";
import { updateStudioClip, type StudioClipResponse } from "@/lib/api/studio";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  filterToApiRecord,
  readClipFilter,
  STUDIO_CLIP_FILTER_PRESETS,
  type StudioClipFilter,
  type StudioClipFilterPreset,
} from "@/lib/studio/composition/clipFilter";
import type { StudioPanelPlacement } from "@/lib/studio/studioEditorLayout";

interface StudioClipFilterPanelProps {
  projectId: number;
  placement: StudioPanelPlacement;
  layoutToggleTitle: string;
  selectedClip: StudioClipResponse | null;
  requireLogin: (action: () => void) => void;
  onBeforeUpdate?: () => void;
  onTogglePlacement: () => void;
  onTracksMutate: () => Promise<unknown>;
}

function readTransformRecord(clip: StudioClipResponse): { [key: string]: unknown } {
  const raw = clip.transform;
  if (!raw || typeof raw !== "object") return {};
  return raw as { [key: string]: unknown };
}

function buildFilterTransform(
  clip: StudioClipResponse,
  filter: StudioClipFilter | null
): { [key: string]: unknown } {
  const base = readTransformRecord(clip);
  if (!filter) {
    const next = { ...base };
    delete next.filter;
    return next;
  }
  return {
    ...base,
    filter: filterToApiRecord(filter),
  };
}

export default function StudioClipFilterPanel({
  projectId,
  placement,
  layoutToggleTitle,
  selectedClip,
  requireLogin,
  onBeforeUpdate,
  onTogglePlacement,
  onTracksMutate,
}: StudioClipFilterPanelProps) {
  const { t } = useLanguage();
  const [savingPreset, setSavingPreset] = useState<StudioClipFilterPreset | "clear" | null>(
    null
  );
  const activeFilter = useMemo(
    () => (selectedClip ? readClipFilter(selectedClip) : null),
    [selectedClip]
  );
  const canApply =
    selectedClip?.media_type === "image" || selectedClip?.media_type === "video";

  const saveFilter = useCallback(
    (filter: StudioClipFilter | null) => {
      if (!selectedClip || !canApply) return;

      requireLogin(() => {
        void (async () => {
          setSavingPreset(filter?.preset ?? "clear");
          onBeforeUpdate?.();
          try {
            await updateStudioClip(projectId, selectedClip.id, {
              transform: buildFilterTransform(selectedClip, filter),
            });
            await onTracksMutate();
            toast.success(t("studioFilterApplySuccess"));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
          } finally {
            setSavingPreset(null);
          }
        })();
      });
    },
    [canApply, onBeforeUpdate, onTracksMutate, projectId, requireLogin, selectedClip, t]
  );

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-medium text-foreground">{t("studioFilters")}</span>
        <StudioLayoutToggleButton
          placement={placement}
          onToggle={onTogglePlacement}
          title={layoutToggleTitle}
        />
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selectedClip ? (
          <EmptyMessage title={t("studioFilterSelectClip")} />
        ) : !canApply ? (
          <EmptyMessage title={t("studioFilterMediaOnly")} />
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {t("studioFilterHint")}
            </p>
            <div className="grid gap-2">
              {STUDIO_CLIP_FILTER_PRESETS.map((preset) => {
                const active = activeFilter?.preset === preset.id;
                const saving = savingPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={savingPreset != null}
                    onClick={() => saveFilter(preset.filter)}
                    className={
                      "cursor-pointer rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
                      (active
                        ? "border-primary/60 bg-primary/15"
                        : "border-white/10 bg-white/5 hover:border-primary/40")
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {t(preset.labelKey)}
                      </span>
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {t(preset.descriptionKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeFilter ? (
              <button
                type="button"
                disabled={savingPreset != null}
                onClick={() => saveFilter(null)}
                className="w-full cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPreset === "clear" ? (
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin text-accent" />
                ) : null}
                {t("studioRemove")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}

function EmptyMessage({ title }: { title: string }) {
  return (
    <div className="flex min-h-full items-center justify-center rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm leading-6 text-muted-foreground">
      {title}
    </div>
  );
}


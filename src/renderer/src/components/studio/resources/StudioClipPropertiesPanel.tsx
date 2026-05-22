"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { updateStudioClip, type StudioClipResponse } from "@/lib/api/studio";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  normalizeTransform,
  readClipTransform,
  transformToApiRecord,
  type StudioClipTransform,
} from "@/lib/studio/composition/clipTransform";
import { formatStudioStatusLabel } from "@/lib/studio/studioI18n";

interface StudioClipPropertiesPanelProps {
  projectId: number;
  selectedClip: StudioClipResponse | null;
  requireLogin: (action: () => void) => void;
  onBeforeUpdate?: () => void;
  onTracksMutate: () => Promise<unknown>;
}

interface TransformDraft {
  x: string;
  y: string;
  scalePercent: string;
  rotation: string;
}

const DEFAULT_TRANSFORM: StudioClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function transformToDraft(transform: StudioClipTransform): TransformDraft {
  return {
    x: formatNumber(transform.x),
    y: formatNumber(transform.y),
    scalePercent: formatNumber(transform.scale * 100),
    rotation: formatNumber(transform.rotation),
  };
}

function parseDraft(draft: TransformDraft): StudioClipTransform | null {
  const x = Number(draft.x);
  const y = Number(draft.y);
  const scalePercent = Number(draft.scalePercent);
  const rotation = Number(draft.rotation);
  if (![x, y, scalePercent, rotation].every(Number.isFinite)) return null;
  return normalizeTransform({
    x,
    y,
    scale: scalePercent / 100,
    rotation,
  });
}

function transformsEqual(a: StudioClipTransform, b: StudioClipTransform): boolean {
  const eps = 0.001;
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.scale - b.scale) < eps &&
    Math.abs(a.rotation - b.rotation) < eps
  );
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 1000) / 1000;
  return `${formatNumber(rounded)}s`;
}

function formatClipMediaType(
  mediaType: string | null | undefined,
  t: (key: TranslationKey) => string
): string {
  if (mediaType === "image") return t("studioAiTypeImage");
  if (mediaType === "video") return t("studioAiTypeVideo");
  if (mediaType === "text") return t("studioAiTypeText");
  return mediaType ?? "-";
}

export default function StudioClipPropertiesPanel({
  projectId,
  selectedClip,
  requireLogin,
  onBeforeUpdate,
  onTracksMutate,
}: StudioClipPropertiesPanelProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const currentTransform = useMemo(
    () => (selectedClip ? readClipTransform(selectedClip) : DEFAULT_TRANSFORM),
    [selectedClip]
  );
  const [draft, setDraft] = useState<TransformDraft>(() =>
    transformToDraft(currentTransform)
  );

  useEffect(() => {
    setDraft(transformToDraft(currentTransform));
  }, [currentTransform]);

  const saveTransform = useCallback(
    (nextTransform: StudioClipTransform) => {
      if (!selectedClip || transformsEqual(nextTransform, currentTransform)) return;

      requireLogin(() => {
        void (async () => {
          setSaving(true);
          onBeforeUpdate?.();
          try {
            await updateStudioClip(projectId, selectedClip.id, {
              transform: transformToApiRecord(nextTransform, selectedClip.transform),
            });
            await onTracksMutate();
            setDraft(transformToDraft(nextTransform));
          } catch (e) {
            setDraft(transformToDraft(currentTransform));
            toast.error(e instanceof Error ? e.message : t("studioTimelineSaveFailed"));
          } finally {
            setSaving(false);
          }
        })();
      });
    },
    [
      currentTransform,
      onBeforeUpdate,
      onTracksMutate,
      projectId,
      requireLogin,
      selectedClip,
      t,
    ]
  );

  const commitDraft = useCallback(() => {
    if (!selectedClip) return;
    const parsed = parseDraft(draft);
    if (!parsed) {
      setDraft(transformToDraft(currentTransform));
      toast.error(t("studioClipPropertyInvalidValue"));
      return;
    }
    saveTransform(parsed);
  }, [currentTransform, draft, saveTransform, selectedClip, t]);

  if (!selectedClip) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 py-12 text-center">
        <div className="mb-6 h-16 w-16 rounded-2xl border-2 border-dashed border-muted-foreground/35" />
        <p className="text-lg font-medium text-muted-foreground">
          {t("studioClipPropertiesEmptyTitle")}
        </p>
        <p className="mt-4 max-w-[18rem] text-sm leading-7 text-muted-foreground/80">
          {t("studioClipPropertiesEmpty")}
        </p>
      </div>
    );
  }

  const clipTitle =
    selectedClip.title?.trim() || `${t("studioClipPropertyTitle")} #${selectedClip.id}`;
  const mediaRangeEnd = selectedClip.media_end_sec ?? selectedClip.source_duration_sec;

  return (
    <div className="space-y-3 p-2">
      <section className="rounded-lg border border-white/10 bg-white/5 p-3">
        <h3 className="mb-2 text-xs font-medium text-foreground">
          {t("studioClipPropertiesInfo")}
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-[10px]">
          <PropertyItem label={t("studioClipPropertyTitle")} value={clipTitle} />
          <PropertyItem
            label={t("studioClipPropertyMediaType")}
            value={formatClipMediaType(selectedClip.media_type, t)}
          />
          <PropertyItem
            label={t("studioClipPropertyStatus")}
            value={formatStudioStatusLabel(selectedClip.status, t)}
          />
          <PropertyItem
            label={t("studioClipPropertyTrack")}
            value={`#${selectedClip.track_id}`}
          />
          <PropertyItem
            label={t("studioClipPropertyWorkflow")}
            value={`#${selectedClip.workflow_id}`}
          />
          <PropertyItem label="ID" value={`#${selectedClip.id}`} />
        </dl>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-3">
        <h3 className="mb-2 text-xs font-medium text-foreground">
          {t("studioClipPropertyTimeline")}
        </h3>
        <dl className="grid grid-cols-3 gap-2 text-[10px]">
          <PropertyItem
            label={t("studioClipPropertyStart")}
            value={formatSeconds(selectedClip.start_sec)}
          />
          <PropertyItem
            label={t("studioClipPropertyDuration")}
            value={formatSeconds(selectedClip.duration_sec)}
          />
          <PropertyItem
            label={t("studioClipPropertyEnd")}
            value={formatSeconds(selectedClip.end_sec)}
          />
        </dl>
        <h3 className="mb-2 mt-3 text-xs font-medium text-foreground">
          {t("studioClipPropertyMediaRange")}
        </h3>
        <dl className="grid grid-cols-2 gap-2 text-[10px]">
          <PropertyItem
            label={t("studioClipPropertyStart")}
            value={formatSeconds(selectedClip.media_start_sec)}
          />
          <PropertyItem
            label={t("studioClipPropertyEnd")}
            value={formatSeconds(mediaRangeEnd)}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-foreground">
            {t("studioClipPropertiesTransform")}
          </h3>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t("studioClipPropertyPositionX")}
            value={draft.x}
            step={1}
            disabled={saving}
            onChange={(value) => setDraft((prev) => ({ ...prev, x: value }))}
            onCommit={commitDraft}
          />
          <NumberField
            label={t("studioClipPropertyPositionY")}
            value={draft.y}
            step={1}
            disabled={saving}
            onChange={(value) => setDraft((prev) => ({ ...prev, y: value }))}
            onCommit={commitDraft}
          />
          <NumberField
            label={t("studioClipPropertyScale")}
            value={draft.scalePercent}
            step={1}
            min={5}
            disabled={saving}
            suffix="%"
            onChange={(value) =>
              setDraft((prev) => ({ ...prev, scalePercent: value }))
            }
            onCommit={commitDraft}
          />
          <NumberField
            label={t("studioClipPropertyRotation")}
            value={draft.rotation}
            step={1}
            disabled={saving}
            suffix="deg"
            onChange={(value) => setDraft((prev) => ({ ...prev, rotation: value }))}
            onCommit={commitDraft}
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => saveTransform(DEFAULT_TRANSFORM)}
          className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          {t("studioClipPropertyResetTransform")}
        </button>
      </section>
    </div>
  );
}

function PropertyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-black/20 px-2 py-1.5">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  min,
  suffix,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  step: number;
  min?: number;
  suffix?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-white/10 bg-black/20 px-2 focus-within:border-primary/50">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-foreground outline-none disabled:opacity-50"
        />
        {suffix ? <span className="shrink-0 pl-1 text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  );
}

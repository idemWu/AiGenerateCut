"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { ingestDragPayloadToReferences } from "@/lib/studio/ai/ingestStudioAiDrag";
import { parseStudioAiDragData, type StudioAiDragPayload } from "@/lib/studio/ai/studioAiDrag";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import type { StudioAiOperationType } from "@/lib/studio/studioAiModels";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import {
  appendExtraVideoReference,
  getBaseVideoReference,
  getFeatureVideoReference,
  getReferImageReferences,
  getReferenceForSlot,
  getVideoSlotsForMode,
  referenceFromSource,
  removeReference,
  type StudioAiReference,
  type StudioVideoExtraKind,
  type StudioVideoMode,
  type StudioVideoSlotDef,
  upsertReferenceForSlot,
} from "@/lib/studio/studioAiResources";
import { uploadStudioAiReferenceFile } from "@/lib/studio/uploadStudioAiReference";

/** 附加参考（Ref images / Ref video / Edit video）暂隐藏，改 true 可恢复 */
const VIDEO_EXTRA_REFERENCES_ENABLED = false;

interface StudioAiReferenceStripProps {
  operationType: StudioAiOperationType;
  videoMode: StudioVideoMode;
  references: StudioAiReference[];
  onReferencesChange: (refs: StudioAiReference[]) => void;
  /** 由父级 ComposerCard 控制整行高亮时可为 false，strip 自身仍处理 drop */
  showDragHighlight?: boolean;
}

type ReferencePayload = Parameters<typeof referenceFromSource>[0];

interface IngestContext {
  operationType: StudioAiOperationType;
  videoMode: StudioVideoMode;
  references: StudioAiReference[];
  onReferencesChange: (refs: StudioAiReference[]) => void;
}

const THUMB_SIZE = "size-16 aspect-square shrink-0 self-start";

function runIngest(
  ctx: IngestContext,
  payload: StudioAiDragPayload | null,
  t: (key: TranslationKey) => string,
  targetSlotId?: string
): boolean {
  const result = ingestDragPayloadToReferences({
    payload,
    operationType: ctx.operationType,
    videoMode: ctx.videoMode,
    references: ctx.references,
    onReferencesChange: ctx.onReferencesChange,
    targetSlotId,
  });
  if (!result.success) {
    toast.error(t("studioAiDropWrongType"));
    return false;
  }
  return true;
}

export default function StudioAiReferenceStrip({
  operationType,
  videoMode,
  references,
  onReferencesChange,
  showDragHighlight = true,
}: StudioAiReferenceStripProps) {
  const { t } = useLanguage();
  const [stripDragOver, setStripDragOver] = useState(false);

  const ingestCtx: IngestContext = {
    operationType,
    videoMode,
    references,
    onReferencesChange,
  };

  const handleStripDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setStripDragOver(false);
      runIngest(ingestCtx, parseStudioAiDragData(e.dataTransfer), t);
    },
    [ingestCtx, t]
  );

  return (
    <div
      className={
        "flex shrink-0 flex-col gap-1 self-start " +
        (showDragHighlight && stripDragOver ? "rounded-lg ring-1 ring-primary/50" : "")
      }
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setStripDragOver(true);
      }}
      onDragLeave={() => setStripDragOver(false)}
      onDrop={handleStripDrop}
    >
      {operationType === "video" ? (
        <VideoReferenceStrip ingestCtx={ingestCtx} videoMode={videoMode} t={t} />
      ) : (
        <ImageReferenceStrip
          references={references.filter((r) => r.inputRole === "image")}
          ingestCtx={ingestCtx}
          onAdd={(payload) => {
            const next = referenceFromSource(payload);
            onReferencesChange(
              upsertReferenceForSlot(references, next, { operationType, videoMode })
            );
          }}
          onRemove={(id) => onReferencesChange(removeReference(references, id))}
          t={t}
        />
      )}
    </div>
  );
}

function ImageReferenceStrip({
  references,
  ingestCtx,
  onAdd,
  onRemove,
  t,
}: {
  references: StudioAiReference[];
  ingestCtx: IngestContext;
  onAdd: (payload: ReferencePayload) => void;
  onRemove: (id: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex max-w-[88px] flex-col gap-1 sm:max-w-none">
      <div className="flex items-start gap-1.5 overflow-x-auto pb-0.5">
        <AddReferenceCell
          acceptMedia="image"
          onAdd={onAdd}
          onDragIngest={(p) => runIngest(ingestCtx, p, t)}
        />
        {references.map((ref) => (
          <ThumbCell key={ref.id} reference={ref} onRemove={() => onRemove(ref.id)} />
        ))}
      </div>
    </div>
  );
}

function VideoReferenceStrip({
  ingestCtx,
  videoMode,
  t,
}: {
  ingestCtx: IngestContext;
  videoMode: StudioVideoMode;
  t: (key: TranslationKey) => string;
}) {
  const slots = getVideoSlotsForMode(videoMode);

  return (
    <div className="flex max-w-[88px] flex-col gap-1.5 sm:max-w-none">
      {slots.length > 0 ? (
        <div className="flex items-start gap-1.5 overflow-x-auto pb-0.5">
          {slots.map((slot) => (
            <SlotCell
              key={slot.slotId}
              slot={slot}
              reference={getReferenceForSlot(ingestCtx.references, slot)}
              ingestCtx={ingestCtx}
              videoMode={videoMode}
              t={t}
            />
          ))}
        </div>
      ) : null}
      {VIDEO_EXTRA_REFERENCES_ENABLED ? (
        <ExtraVideoReferenceStrip ingestCtx={ingestCtx} t={t} />
      ) : null}
    </div>
  );
}

function ExtraVideoReferenceStrip({
  ingestCtx,
  t,
}: {
  ingestCtx: IngestContext;
  t: (key: TranslationKey) => string;
}) {
  const { references, onReferencesChange } = ingestCtx;
  const referRefs = getReferImageReferences(references);
  const featureRef = getFeatureVideoReference(references);
  const baseRef = getBaseVideoReference(references);

  const handleExtraAdd = (
    kind: StudioVideoExtraKind,
    payload: ReferencePayload,
    allowKeepSound?: boolean
  ) => {
    const next = referenceFromSource({
      ...payload,
      inputParams: allowKeepSound ? { keep_original_sound: false } : undefined,
    });
    onReferencesChange(appendExtraVideoReference(references, kind, next));
  };

  return (
    <div className="flex flex-wrap items-start gap-1.5 overflow-x-auto pb-0.5">
      <ExtraReferImagesGroup
        referRefs={referRefs}
        ingestCtx={ingestCtx}
        onAdd={(payload) => handleExtraAdd("refer_image", payload)}
        onRemove={(id) => onReferencesChange(removeReference(references, id))}
        t={t}
      />
      <ExtraVideoSlot
        label={t("studioAiExtraFeatureVideo")}
        slotId="extra_feature"
        reference={featureRef}
        acceptMedia="video"
        allowKeepSound
        ingestCtx={ingestCtx}
        onAdd={(payload) => handleExtraAdd("feature_video", payload, true)}
        onRemove={() => {
          if (featureRef) {
            onReferencesChange(removeReference(references, featureRef.id));
          }
        }}
        onKeepSoundChange={
          featureRef
            ? (keep) =>
                onReferencesChange(
                  references.map((r) =>
                    r.id === featureRef.id
                      ? { ...r, inputParams: { keep_original_sound: keep } }
                      : r
                  )
                )
            : undefined
        }
        t={t}
      />
      <ExtraVideoSlot
        label={t("studioAiExtraBaseVideo")}
        slotId="extra_base"
        reference={baseRef}
        acceptMedia="video"
        allowKeepSound
        ingestCtx={ingestCtx}
        onAdd={(payload) => handleExtraAdd("base_video", payload, true)}
        onRemove={() => {
          if (baseRef) {
            onReferencesChange(removeReference(references, baseRef.id));
          }
        }}
        onKeepSoundChange={
          baseRef
            ? (keep) =>
                onReferencesChange(
                  references.map((r) =>
                    r.id === baseRef.id
                      ? { ...r, inputParams: { keep_original_sound: keep } }
                      : r
                  )
                )
            : undefined
        }
        t={t}
      />
    </div>
  );
}

function ExtraReferImagesGroup({
  referRefs,
  ingestCtx,
  onAdd,
  onRemove,
  t,
}: {
  referRefs: StudioAiReference[];
  ingestCtx: IngestContext;
  onAdd: (payload: ReferencePayload) => void;
  onRemove: (id: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span className="max-w-[72px] truncate text-[9px] text-muted-foreground">
        {t("studioAiExtraReferImages")}
      </span>
      <div className="flex items-start gap-1">
        <AddReferenceCell
          acceptMedia="image"
          onAdd={onAdd}
          onDragIngest={(p) => runIngest(ingestCtx, p, t, "extra_refer")}
        />
        {referRefs.map((ref) => (
          <ThumbCell key={ref.id} reference={ref} onRemove={() => onRemove(ref.id)} />
        ))}
      </div>
    </div>
  );
}

function ExtraVideoSlot({
  label,
  slotId,
  reference,
  acceptMedia,
  allowKeepSound,
  ingestCtx,
  onAdd,
  onRemove,
  onKeepSoundChange,
  t,
}: {
  label: string;
  slotId: string;
  reference: StudioAiReference | undefined;
  acceptMedia: "image" | "video";
  allowKeepSound?: boolean;
  ingestCtx: IngestContext;
  onAdd: (payload: ReferencePayload) => void;
  onRemove: () => void;
  onKeepSoundChange?: (keep: boolean) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span className="max-w-[72px] truncate text-[9px] text-muted-foreground">{label}</span>
      {reference ? (
        <ThumbCell
          reference={reference}
          onRemove={onRemove}
          showKeepSound={allowKeepSound}
          onKeepSoundChange={onKeepSoundChange}
        />
      ) : (
        <AddReferenceCell
          acceptMedia={acceptMedia}
          onAdd={onAdd}
          onDragIngest={(p) => runIngest(ingestCtx, p, t, slotId)}
          optional
        />
      )}
    </div>
  );
}

function SlotCell({
  slot,
  reference,
  ingestCtx,
  videoMode,
  t,
}: {
  slot: StudioVideoSlotDef;
  reference: StudioAiReference | undefined;
  ingestCtx: IngestContext;
  videoMode: StudioVideoMode;
  t: (key: TranslationKey) => string;
}) {
  const { references, onReferencesChange } = ingestCtx;
  const label = getSlotShortLabel(slot.slotId, t);

  const handleAdd = (payload: ReferencePayload) => {
    const next = referenceFromSource({
      ...payload,
      inputParams: slot.allowKeepSound ? { keep_original_sound: false } : undefined,
    });
    onReferencesChange(
      upsertReferenceForSlot(references, next, {
        operationType: "video",
        videoMode,
        slotId: slot.slotId,
      })
    );
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span className="max-w-[64px] truncate text-[9px] text-muted-foreground">{label}</span>
      {reference ? (
        <ThumbCell
          reference={reference}
          onRemove={() => onReferencesChange(removeReference(references, reference.id))}
          showKeepSound={slot.allowKeepSound}
          onKeepSoundChange={
            slot.allowKeepSound
              ? (keep) =>
                  onReferencesChange(
                    references.map((r) =>
                      r.id === reference.id
                        ? { ...r, inputParams: { keep_original_sound: keep } }
                        : r
                    )
                  )
              : undefined
          }
        />
      ) : (
        <AddReferenceCell
          acceptMedia={slot.mediaType}
          onAdd={handleAdd}
          onDragIngest={(p) => runIngest(ingestCtx, p, t, slot.slotId)}
          optional={slot.optional}
        />
      )}
    </div>
  );
}

function AddReferenceCell({
  acceptMedia,
  onAdd,
  onDragIngest,
  optional,
}: {
  acceptMedia: "image" | "video";
  onAdd: (payload: ReferencePayload) => void;
  onDragIngest: (payload: StudioAiDragPayload | null) => void;
  optional?: boolean;
}) {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptAttr = acceptMedia === "image" ? "image/*" : "video/*";

  const handleUpload = async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    if ((acceptMedia === "image" && isVideo) || (acceptMedia === "video" && !isVideo)) {
      toast.error(t("studioAiDropWrongType"));
      return;
    }
    setUploading(true);
    try {
      const { objectKey, mediaType } = await uploadStudioAiReferenceFile(file);
      onAdd({
        source: { kind: "upload", objectKey, mediaType },
        label: file.name,
        thumbUrl: mediaType === "image" ? objectKey : null,
        inputRole: "image",
        sortOrder: 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("studioTimelineSaveFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        onDragIngest(parseStudioAiDragData(e.dataTransfer));
      }}
      className={cnThumbAdd(dragOver, optional)}
    >
      <input
        ref={fileRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex size-full cursor-pointer items-center justify-center"
        aria-label={t("studioAiUploadReference")}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Plus className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function ThumbCell({
  reference,
  onRemove,
  showKeepSound,
  onKeepSoundChange,
}: {
  reference: StudioAiReference;
  onRemove: () => void;
  showKeepSound?: boolean;
  onKeepSoundChange?: (keep: boolean) => void;
}) {
  const { t } = useLanguage();
  const rawThumb =
    reference.thumbUrl ??
    (reference.source.kind === "upload" && reference.source.mediaType === "image"
      ? reference.source.objectKey
      : null);
  const thumb = resolveStudioMediaUrl(rawThumb) ?? rawThumb;
  const isVideo =
    reference.source.kind === "node_output"
      ? reference.source.mediaType === "video"
      : reference.source.kind === "upload" && reference.source.mediaType === "video";

  return (
    <div className={`group relative ${THUMB_SIZE}`}>
      <div
        className={
          "relative h-full w-full overflow-hidden rounded-lg border border-white/15 bg-white/5 " +
          THUMB_SIZE
        }
      >
        {thumb && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase text-muted-foreground">
            {isVideo ? t("studioAiTypeVideo") : t("studioAiTypeImage")}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 cursor-pointer rounded-full bg-black/70 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={t("studioRemove")}
        >
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
      {showKeepSound && onKeepSoundChange ? (
        <button
          type="button"
          onClick={() =>
            onKeepSoundChange(!(reference.inputParams?.keep_original_sound ?? false))
          }
          className={
            "absolute -bottom-0.5 left-1/2 -translate-x-1/2 cursor-pointer whitespace-nowrap rounded bg-background/90 px-1 py-px text-[8px] " +
            (reference.inputParams?.keep_original_sound ? "text-primary" : "text-muted-foreground")
          }
          title={t("studioAiKeepOriginalSound")}
        >
          {reference.inputParams?.keep_original_sound ? t("studioAiSoundOn") : t("studioAiSoundOff")}
        </button>
      ) : null}
    </div>
  );
}

function cnThumbAdd(dragOver: boolean, optional?: boolean): string {
  return (
    `${THUMB_SIZE} flex items-center justify-center rounded-lg border border-dashed p-0 transition-colors ` +
    (dragOver
      ? "border-primary bg-primary/10"
      : optional
        ? "border-white/10 bg-white/[0.02]"
        : "border-white/15 bg-white/5")
  );
}

function getSlotShortLabel(slotId: string, t: (key: TranslationKey) => string): string {
  const map: Record<string, string> = {
    first_frame: t("studioAiSlotShortFirst"),
    last_frame: t("studioAiSlotShortLast"),
    refer: t("studioAiSlotShortRefer"),
    refer_optional: t("studioAiSlotShortRefer"),
    feature: t("studioAiSlotShortFeature"),
    base: t("studioAiSlotShortBase"),
  };
  return map[slotId] ?? slotId;
}

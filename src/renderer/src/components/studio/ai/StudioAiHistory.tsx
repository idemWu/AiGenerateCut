"use client";

import { useEffect, useMemo, useRef } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type {
  StudioWorkflowNodeInputResponse,
  StudioWorkflowNodeResponse,
} from "@/lib/api/studio";
import type { PendingNodeInputThumb } from "@/lib/studio/ai/buildPendingNodeInputThumbs";
import {
  resolveNodeInputMediaType,
  resolveNodeInputThumbUrl,
  type ResolveNodeInputThumbUrlOptions,
} from "@/lib/studio/ai/resolveNodeInputThumbUrl";
import { setStudioAiDragData } from "@/lib/studio/ai/studioAiDrag";
import { useStudioKeyframes } from "@/lib/hooks/useStudio";
import {
  formatStudioOperationTypeLabel,
  formatStudioStatusLabel,
} from "@/lib/studio/studioI18n";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import {
  flattenStudioModels,
  type StudioAiModelListResponse,
} from "@/lib/studio/studioAiModels";

interface StudioAiHistoryProps {
  projectId: number;
  nodes: StudioWorkflowNodeResponse[];
  models: StudioAiModelListResponse | undefined;
  useApplyAction: boolean;
  pendingInputThumbsByNodeId: ReadonlyMap<number, PendingNodeInputThumb[]>;
  onApplyToClip: (outputId: number, mediaType: string, duration?: number) => void;
  onAddToTimeline: (outputId: number, mediaType: string, duration?: number) => void;
  onRetry: (nodeId: number) => Promise<void>;
}

export default function StudioAiHistory({
  projectId,
  nodes,
  models,
  useApplyAction,
  pendingInputThumbsByNodeId,
  onApplyToClip,
  onAddToTimeline,
  onRetry,
}: StudioAiHistoryProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { keyframes } = useStudioKeyframes(projectId);

  const keyframesById = useMemo(() => {
    const map = new Map<number, string | null | undefined>();
    for (const kf of keyframes) {
      map.set(kf.id, kf.image_url);
    }
    return map;
  }, [keyframes]);

  const modelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const model of flattenStudioModels(models)) {
      map.set(model.id, model.name?.trim() || model.id);
    }
    return map;
  }, [models]);

  const sorted = [...nodes].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return ta - tb;
  });
  const nodeStatusKey = nodes.map((n) => n.status).join(",");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nodes.length, nodeStatusKey]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("studioAiHistoryEmpty")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      {sorted.map((node) => (
        <HistoryEntry
          key={node.id}
          node={node}
          keyframesById={keyframesById}
          modelNameById={modelNameById}
          pendingThumbs={pendingInputThumbsByNodeId.get(node.id)}
          useApplyAction={useApplyAction}
          onApplyToClip={onApplyToClip}
          onAddToTimeline={onAddToTimeline}
          onRetry={onRetry}
        />
      ))}
      <div ref={bottomRef} className="h-px shrink-0" />
    </div>
  );
}

interface HistoryEntryProps {
  node: StudioWorkflowNodeResponse;
  keyframesById: Map<number, string | null | undefined>;
  modelNameById: ReadonlyMap<string, string>;
  pendingThumbs?: PendingNodeInputThumb[];
  useApplyAction: boolean;
  onApplyToClip: (outputId: number, mediaType: string, duration?: number) => void;
  onAddToTimeline: (outputId: number, mediaType: string, duration?: number) => void;
  onRetry: (nodeId: number) => Promise<void>;
}

function HistoryEntry({
  node,
  keyframesById,
  modelNameById,
  pendingThumbs,
  useApplyAction,
  onApplyToClip,
  onAddToTimeline,
  onRetry,
}: HistoryEntryProps) {
  const { t } = useLanguage();
  const isPending = node.status === "pending" || node.status === "processing";
  const outputs = node.outputs ?? [];
  const operationLabel = formatStudioOperationTypeLabel(node.operation_type, t);
  const statusLabel = formatStudioStatusLabel(node.status, t);
  const metaItems = getResultMetaItems(node, modelNameById);
  const resolveOptions = useMemo(
    () => ({ keyframesById, pendingThumbs }),
    [keyframesById, pendingThumbs]
  );
  const inputThumbs = useMemo(
    () => getHistoryInputThumbItems(node, resolveOptions, pendingThumbs, t),
    [node, pendingThumbs, resolveOptions, t]
  );
  const prompt = node.prompt?.trim();
  const hasInputContent = inputThumbs.length > 0 || !!prompt;

  return (
    <article className="flex w-full flex-col">
      <div className="w-full rounded-xl border border-white/10 bg-white/5 p-2">
        <header className="mb-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
          <span>{operationLabel}</span>
          <span>·</span>
          {isPending ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              {statusLabel}
            </span>
          ) : (
            <span>{statusLabel}</span>
          )}
        </header>

        {node.status === "failed" ? (
          <div className="space-y-1">
            {node.error_message ? (
              <p className="text-xs text-destructive">{node.error_message}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void onRetry(node.id)}
              className="cursor-pointer text-xs text-accent hover:underline"
            >
              {t("studioRetry")}
            </button>
          </div>
        ) : null}

        {hasInputContent ? (
          <div className="mb-2 flex flex-wrap items-start gap-2 rounded-lg border border-white/10 bg-black/15 px-2 py-2">
            {prompt ? (
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                  {prompt}
                </p>
              </div>
            ) : null}
            {inputThumbs.length > 0 ? (
              <div className="flex shrink-0 flex-wrap items-start gap-1.5">
                <div className="flex flex-wrap gap-1">
                  {inputThumbs.map((item) => (
                    <HistoryInputThumb
                      key={item.key}
                      thumbUrl={item.thumbUrl}
                      mediaType={item.mediaType}
                      roleLabel={item.roleLabel}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {outputs.map((output) => {
          const isVideo = output.output_type === "video";
          const thumb = resolveStudioMediaUrl(output.object_url);
          const textOut = output.text_content;

          if (textOut) {
            return (
              <p
                key={output.id}
                className="whitespace-pre-wrap text-xs leading-relaxed text-foreground"
              >
                {textOut}
              </p>
            );
          }

          if (!thumb) return null;

          return (
            <DraggableOutputThumb
              key={output.id}
              outputId={output.id}
              thumbUrl={thumb}
              label={`${operationLabel} #${output.id}`}
              mediaType={isVideo ? "video" : "image"}
              aspectRatio={node.aspect_ratio}
            />
          );
        })}

        {node.status === "succeeded" && outputs[0] ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {useApplyAction ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const output = outputs[0]!;
                    onApplyToClip(output.id, output.output_type, node.duration_sec ?? 5);
                  }}
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  {t("studioAiApplyToClip")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const output = outputs[0]!;
                    onAddToTimeline(output.id, output.output_type, node.duration_sec ?? 5);
                  }}
                  className="cursor-pointer text-xs font-medium text-accent hover:underline"
                >
                  {t("studioAiCreateAtPlayhead")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const output = outputs[0]!;
                  onAddToTimeline(output.id, output.output_type, node.duration_sec ?? 5);
                }}
                className="cursor-pointer text-xs font-medium text-primary hover:underline"
              >
                {t("studioAiCreateAtPlayhead")}
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          {metaItems.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="max-w-32 truncate rounded-full bg-white/5 px-2 py-1 text-[10px] text-foreground"
              title={item}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

interface HistoryInputThumbItem {
  key: string;
  thumbUrl: string;
  mediaType: "image" | "video";
  roleLabel: string;
}

function getHistoryInputThumbItems(
  node: StudioWorkflowNodeResponse,
  resolveOptions: ResolveNodeInputThumbUrlOptions,
  pendingThumbs: PendingNodeInputThumb[] | undefined,
  t: (key: TranslationKey) => string
): HistoryInputThumbItem[] {
  const mediaInputs = (node.inputs ?? [])
    .filter((input) => input.media_type === "image" || input.media_type === "video")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (mediaInputs.length > 0) {
    return mediaInputs.flatMap((input, index) => {
      const thumbUrl = resolveNodeInputThumbUrl(input, node, resolveOptions);
      if (!thumbUrl) return [];
      return [
        {
          key: `input-${input.id ?? `${input.input_role}-${input.sort_order ?? index}`}`,
          thumbUrl,
          mediaType: resolveNodeInputMediaType(input, resolveOptions),
          roleLabel: getInputRoleShortLabel(input.input_role, t),
        },
      ];
    });
  }

  return (pendingThumbs ?? []).flatMap((p, index) =>
    p.thumbUrl
      ? [
          {
            key: `pending-${p.inputRole}-${p.sortOrder}-${index}`,
            thumbUrl: p.thumbUrl,
            mediaType: p.mediaType,
            roleLabel: getInputRoleShortLabel(p.inputRole, t),
          },
        ]
      : []
  );
}

function getResultMetaItems(
  node: StudioWorkflowNodeResponse,
  modelNameById: ReadonlyMap<string, string>
): string[] {
  const items = [
    formatModelMetaValue(node.model, modelNameById),
    formatMetaValue(node.aspect_ratio),
  ];

  if (node.operation_type === "video") {
    items.push(formatDurationMetaValue(node.duration_sec));
  } else if (node.operation_type === "image") {
    items.push(formatMetaValue(node.image_size));
  }

  return items;
}

function formatModelMetaValue(
  modelId: string | null | undefined,
  modelNameById: ReadonlyMap<string, string>
): string {
  const id = modelId?.trim();
  if (!id) return "—";
  return modelNameById.get(id) ?? id;
}

function formatMetaValue(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function formatDurationMetaValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${value}s`
    : "—";
}

function HistoryInputThumb({
  thumbUrl,
  mediaType,
  roleLabel,
}: {
  thumbUrl: string;
  mediaType: "image" | "video";
  roleLabel: string;
}) {
  const isVideo = mediaType === "video";

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/5">
      {!isVideo ? (
        <img
          src={thumbUrl}
          alt=""
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <video
          src={thumbUrl}
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          draggable={false}
        />
      )}
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/70 px-0.5 py-px text-center text-[8px] text-white">
        {roleLabel}
      </span>
    </div>
  );
}

function getInputRoleShortLabel(
  role: StudioWorkflowNodeInputResponse["input_role"] | PendingNodeInputThumb["inputRole"],
  t: (key: TranslationKey) => string
): string {
  const map: Partial<Record<string, string>> = {
    first_frame: t("studioAiSlotShortFirst"),
    last_frame: t("studioAiSlotShortLast"),
    reference: t("studioAiSlotShortRefer"),
    refer: t("studioAiSlotShortRefer"),
    feature: t("studioAiSlotShortFeature"),
    base: t("studioAiSlotShortBase"),
    image: t("studioAiSlotShortRefer"),
    video: t("studioAiSlotShortFeature"),
  };
  return map[role] ?? role;
}

function DraggableOutputThumb({
  outputId,
  thumbUrl,
  label,
  mediaType,
  aspectRatio,
}: {
  outputId: number;
  thumbUrl: string;
  label: string;
  mediaType: "image" | "video";
  aspectRatio?: string | null;
}) {
  const { t } = useLanguage();
  const videoSrc = mediaType === "video" ? withVideoPreviewTime(thumbUrl) : thumbUrl;
  const videoAspectRatio = parseAspectRatioStyle(aspectRatio);
  const downloadFilename = buildOutputDownloadFilename(outputId, mediaType, thumbUrl);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setStudioAiDragData(e.dataTransfer, {
      source: { kind: "node_output", outputId, mediaType },
      label,
      thumbUrl,
    });
    if (e.dataTransfer.setDragImage && e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 32, 32);
    }
  };

  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void downloadStudioMedia(thumbUrl, downloadFilename);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group relative cursor-grab active:cursor-grabbing"
      title={t("studioAiDragHint")}
    >
      <button
        type="button"
        onClick={handleDownload}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-1 top-1 z-10 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white shadow-sm transition hover:bg-black/80 focus:outline-none focus:ring-1 focus:ring-white/70"
        title={t("studioDownload")}
        aria-label={t("studioDownload")}
        draggable={false}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      {mediaType === "image" ? (
        <img
          src={thumbUrl}
          alt=""
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="pointer-events-none max-h-40 w-full rounded-lg object-cover"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      ) : (
        <div
          className="max-h-40 overflow-hidden rounded-lg bg-black/50"
          style={{ aspectRatio: videoAspectRatio }}
        >
          <video
            src={videoSrc}
            crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
            className="h-full w-full object-contain"
            controls
            muted
            playsInline
            preload="metadata"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {t("studioAiDragHint")}
      </span>
    </div>
  );
}

function parseAspectRatioStyle(value: string | null | undefined): string | undefined {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  return `${match[1]} / ${match[2]}`;
}

function withVideoPreviewTime(url: string): string {
  if (url.includes("#")) return url;
  return `${url}#t=0.1`;
}

function buildOutputDownloadFilename(
  outputId: number,
  mediaType: "image" | "video",
  url: string
): string {
  const extension = inferFileExtension(url) ?? (mediaType === "video" ? "mp4" : "png");
  return `studio-output-${outputId}.${extension}`;
}

function inferFileExtension(url: string): string | null {
  const clean = url.split(/[?#]/)[0] ?? "";
  const fileName = clean.split("/").pop() ?? "";
  const match = fileName.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function triggerBrowserDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadStudioMedia(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blobUrl = URL.createObjectURL(await res.blob());
    try {
      triggerBrowserDownload(blobUrl, filename);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  } catch {
    triggerBrowserDownload(url, filename);
  }
}

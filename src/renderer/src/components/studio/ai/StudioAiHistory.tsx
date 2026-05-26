"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { StudioWorkflowNodeResponse } from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import type { PendingNodeInputThumb } from "@/lib/studio/ai/buildPendingNodeInputThumbs";
import {
  resolveNodeInputMediaType,
  resolveNodeInputThumbUrl,
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

type StudioWorkflowNodeInputResponse =
  components["schemas"]["StudioWorkflowNodeInputResponse"];

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
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
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
  const prompt = node.prompt?.trim();
  const metaItems = getResultMetaItems(node, modelNameById);

  return (
    <article className="flex flex-col gap-2">
      <UserRequestBubble
        node={node}
        keyframesById={keyframesById}
        pendingThumbs={pendingThumbs}
      />

      <div className="mr-auto max-w-[92%] rounded-xl rounded-tl-sm border border-white/10 bg-white/5 p-2">
        {prompt ? (
          <div className="mb-2 rounded-lg border border-white/10 bg-black/15 px-2.5 py-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("studioPrompt")}
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {prompt}
            </p>
          </div>
        ) : null}

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

function getResultMetaItems(
  node: StudioWorkflowNodeResponse,
  modelNameById: ReadonlyMap<string, string>
): string[] {
  return [
    formatModelMetaValue(node.model, modelNameById),
    formatMetaValue(node.aspect_ratio),
    formatMetaValue(node.image_size),
  ];
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

interface UserRequestBubbleProps {
  node: StudioWorkflowNodeResponse;
  keyframesById: Map<number, string | null | undefined>;
  pendingThumbs?: PendingNodeInputThumb[];
}

function UserRequestBubble({ node, keyframesById, pendingThumbs }: UserRequestBubbleProps) {
  const { t } = useLanguage();
  const resolveOptions = useMemo(
    () => ({ keyframesById, pendingThumbs }),
    [keyframesById, pendingThumbs]
  );

  const mediaInputs = (node.inputs ?? []).filter(
    (input) => input.media_type === "image" || input.media_type === "video"
  );

  const thumbItems = useMemo(() => {
    if (mediaInputs.length > 0) {
      return mediaInputs.map((input) => ({
        key: `input-${input.id}`,
        thumbUrl: resolveNodeInputThumbUrl(input, node, resolveOptions),
        mediaType: resolveNodeInputMediaType(input, resolveOptions),
        roleLabel: getInputRoleShortLabel(input.input_role, t),
      }));
    }
    return (pendingThumbs ?? []).map((p, index) => ({
      key: `pending-${p.inputRole}-${p.sortOrder}-${index}`,
      thumbUrl: p.thumbUrl,
      mediaType: p.mediaType,
      roleLabel: getInputRoleShortLabel(p.inputRole, t),
    }));
  }, [mediaInputs, node, pendingThumbs, resolveOptions, t]);

  const visibleThumbs = thumbItems.filter((item) => item.thumbUrl);

  if (visibleThumbs.length === 0) {
    return null;
  }

  return (
    <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-primary/20 px-3 py-2 text-xs text-foreground">
      <div className="flex flex-wrap gap-1">
        {visibleThumbs.map((item) => (
          <HistoryInputThumb
            key={item.key}
            thumbUrl={item.thumbUrl!}
            mediaType={item.mediaType}
            roleLabel={item.roleLabel}
          />
        ))}
      </div>
    </div>
  );
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
}: {
  outputId: number;
  thumbUrl: string;
  label: string;
  mediaType: "image" | "video";
}) {
  const { t } = useLanguage();

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

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group relative cursor-grab active:cursor-grabbing"
      title={t("studioAiDragHint")}
    >
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
        <video
          src={thumbUrl}
          crossOrigin={STUDIO_MEDIA_CROSS_ORIGIN}
          className="pointer-events-none max-h-40 w-full rounded-lg object-cover"
          muted
          playsInline
          preload="metadata"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {t("studioAiDragHint")}
      </span>
    </div>
  );
}

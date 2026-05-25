"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { captureCanvasToPngBlob } from "@/lib/studio/capturePreviewFrame";
import { resolveStudioMediaUrl } from "@/lib/studio/resolveStudioMediaUrl";
import { STUDIO_MEDIA_CROSS_ORIGIN } from "@/lib/studio/studioMediaCrossOrigin";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { StudioClipResponse, StudioTimelineTrackResponse } from "@/lib/api/studio";
import type { components } from "@/lib/api/schema";
import { aspectRatioToCanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import {
  applyClipWithTransform,
  type StudioClipTransform,
} from "@/lib/studio/composition/clipTransform";
import {
  applyClipWithTextContent,
  renderFrameToCanvas,
} from "@/lib/studio/composition/renderFrame";
import type { TrackClipAtTime } from "@/lib/studio/playback/resolveClipsAtTime";
import {
  promoteSelectedClipLayer,
  resolveClipsAtTime,
  resolveClipsAtTimeSorted,
  sortTracksForRender,
} from "@/lib/studio/playback/resolveClipsAtTime";
import type { PlayheadSubscriber } from "@/lib/studio/playback/useStudioPlayback";
import { clipPoolKey } from "@/lib/studio/playback/videoPool";
import StudioClipInlineTextEdit, {
  type StudioClipInlineTextEditHandle,
} from "./StudioClipInlineTextEdit";
import StudioClipTransformOverlay from "./StudioClipTransformOverlay";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

export interface StudioPreviewPlayerHandle {
  capturePreviewFrame: () => Promise<Blob>;
}

interface StudioPreviewPlayerProps {
  projectId: number;
  aspectRatio: StudioAspectRatio;
  tracks: StudioTimelineTrackResponse[];
  playheadSec: number;
  playheadRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  selectedClip: StudioClipResponse | null;
  videoPoolRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  requireLogin: (action: () => void) => void;
  onTracksMutate: () => Promise<unknown>;
  setSelectedClipId: (id: number | null) => void;
  subscribePlayhead: (fn: PlayheadSubscriber) => () => void;
}

function mergeDraftIntoLayers(
  layers: TrackClipAtTime[],
  clipId: number,
  patch: (clip: StudioClipResponse) => StudioClipResponse
): TrackClipAtTime[] {
  return layers.map((layer) =>
    layer.clip.id === clipId ? { ...layer, clip: patch(layer.clip) } : layer
  );
}

const StudioPreviewPlayer = forwardRef<StudioPreviewPlayerHandle, StudioPreviewPlayerProps>(
  function StudioPreviewPlayer(
    {
      projectId,
      aspectRatio,
      tracks,
      playheadSec,
      playheadRef,
      isPlaying,
      selectedClip,
      videoPoolRef,
      requireLogin,
      onTracksMutate,
      setSelectedClipId,
      subscribePlayhead,
    },
    ref
  ) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textEditRef = useRef<StudioClipInlineTextEditHandle>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const tracksRef = useRef(tracks);
  const sortedTracksRef = useRef<StudioTimelineTrackResponse[]>([]);
  const [draftTransform, setDraftTransform] = useState<StudioClipTransform | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [textEditing, setTextEditing] = useState(false);
  const size = useMemo(() => aspectRatioToCanvasSize(aspectRatio), [aspectRatio]);
  const sizeRef = useRef(size);
  const emptyPreview = t("studioTextClipEmptyPreview");
  const emptyPreviewRef = useRef(emptyPreview);
  const selectedClipRef = useRef<StudioClipResponse | null>(selectedClip);
  const draftTransformRef = useRef<StudioClipTransform | null>(draftTransform);
  const draftTextRef = useRef<string | null>(draftText);
  const textEditingRef = useRef(textEditing);
  const preloadedImageUrlsRef = useRef<Set<string>>(new Set());

  const handleTextClipDoubleClick = useCallback(() => {
    textEditRef.current?.startEditing();
  }, []);

  tracksRef.current = tracks;
  sortedTracksRef.current = useMemo(() => sortTracksForRender(tracks), [tracks]);
  playheadRef.current = playheadSec;
  sizeRef.current = size;
  emptyPreviewRef.current = emptyPreview;
  selectedClipRef.current = selectedClip;
  draftTransformRef.current = draftTransform;
  draftTextRef.current = draftText;
  textEditingRef.current = textEditing;

  useEffect(() => {
    setDraftTransform(null);
    setDraftText(null);
    setTextEditing(false);
  }, [selectedClip?.id]);

  const layers = useMemo(
    () => resolveClipsAtTime(tracks, playheadSec),
    [tracks, playheadSec]
  );

  const getImageElement = useCallback(
    (url: string, onReady?: () => void) => {
      const cache = imageCacheRef.current;
      let img = cache.get(url);
      if (!img) {
        img = new Image();
        img.crossOrigin = STUDIO_MEDIA_CROSS_ORIGIN;
        img.onload = () => onReady?.();
        img.src = resolveStudioMediaUrl(url) ?? url;
        cache.set(url, img);
      } else if (!img.complete) {
        img.onload = () => onReady?.();
      }
      return img;
    },
    []
  );

  const getVideoElement = useCallback(
    (clip: StudioClipResponse) => {
      const pooled = videoPoolRef.current.get(clipPoolKey(clip));
      if (pooled && pooled.readyState >= 2) return pooled;
      return undefined;
    },
    [videoPoolRef]
  );

  // 只读 ref 的稳定 drawFrame：单次 resolveClipsAtTimeSorted，复用同一 layers 给 preload。
  const drawFrame = useCallback((): TrackClipAtTime[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const selected = selectedClipRef.current;
    let currentLayers = resolveClipsAtTimeSorted(
      sortedTracksRef.current,
      playheadRef.current
    );
    currentLayers = promoteSelectedClipLayer(currentLayers, selected?.id ?? null);
    if (selected) {
      const draftT = draftTransformRef.current;
      if (draftT) {
        currentLayers = mergeDraftIntoLayers(currentLayers, selected.id, (clip) =>
          applyClipWithTransform(clip, draftT)
        );
      }
      const draftTx = draftTextRef.current;
      if (draftTx !== null) {
        currentLayers = mergeDraftIntoLayers(currentLayers, selected.id, (clip) =>
          applyClipWithTextContent(clip, draftTx)
        );
      }
    }
    renderFrameToCanvas(
      ctx,
      sizeRef.current,
      currentLayers,
      {
        getVideoElement,
        getImageElement: (url) => getImageElement(url),
      },
      {
        previewTextPlaceholder: emptyPreviewRef.current,
        hidePlaceholderClipId: textEditingRef.current ? (selected?.id ?? null) : null,
      }
    );
    return currentLayers;
  }, [getVideoElement, getImageElement]);

  const preloadImageLayers = useCallback(
    (clipLayers: TrackClipAtTime[]) => {
      const seen = preloadedImageUrlsRef.current;
      let changed = false;
      const next = new Set<string>();
      for (const layer of clipLayers) {
        if (layer.clip.media_type !== "image") continue;
        const url = layer.clip.media_url;
        if (!url) continue;
        next.add(url);
        if (!seen.has(url)) changed = true;
      }
      if (!changed && next.size === seen.size) return;
      preloadedImageUrlsRef.current = next;
      for (const url of next) {
        getImageElement(url, () => {
          drawFrame();
        });
      }
    },
    [getImageElement, drawFrame]
  );

  // 暂停态：依赖 layers / 草稿变化重绘 + 预热可见图片
  useEffect(() => {
    if (isPlaying) return;
    const drawn = drawFrame();
    preloadImageLayers(drawn.length ? drawn : layers);
  }, [isPlaying, layers, drawFrame, draftTransform, draftText, preloadImageLayers]);

  // 播放态：订阅 hook 推送的 playhead，每帧只 resolve 一次，画完顺带 throttle 预热图片
  useEffect(() => {
    if (!isPlaying) return;
    let lastPreloadAt = 0;
    const unsub = subscribePlayhead(() => {
      const drawn = drawFrame();
      const now = performance.now();
      if (now - lastPreloadAt >= 250) {
        lastPreloadAt = now;
        preloadImageLayers(drawn);
      }
    });
    drawFrame();
    return () => {
      unsub();
    };
  }, [isPlaying, subscribePlayhead, drawFrame, preloadImageLayers]);

  // 暂停态：video 元素状态变化时重绘，listener 一次性挂载到当前 pool
  useEffect(() => {
    if (isPlaying) return;
    const pool = videoPoolRef.current;
    const redraw = () => {
      drawFrame();
    };
    const attached: HTMLVideoElement[] = [];
    for (const video of pool.values()) {
      video.addEventListener("seeked", redraw);
      video.addEventListener("loadeddata", redraw);
      video.addEventListener("loadedmetadata", redraw);
      attached.push(video);
    }
    return () => {
      for (const video of attached) {
        video.removeEventListener("seeked", redraw);
        video.removeEventListener("loadeddata", redraw);
        video.removeEventListener("loadedmetadata", redraw);
      }
    };
  }, [isPlaying, videoPoolRef, drawFrame, tracks]);

  useImperativeHandle(
    ref,
    () => ({
      capturePreviewFrame: async () => {
        drawFrame();
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error(t("studioPreviewNotReady"));
        }
        return captureCanvasToPngBlob(canvas);
      },
    }),
    [drawFrame, t]
  );

  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
      <div
        className="relative max-h-full max-w-full overflow-hidden rounded-lg bg-black shadow-lg"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          className="h-full w-full object-contain"
        />
      </div>
      <StudioClipTransformOverlay
        projectId={projectId}
        canvasRef={canvasRef}
        canvasSize={size}
        tracks={tracks}
        playheadSec={playheadSec}
        selectedClip={selectedClip}
        isPlaying={isPlaying}
        draftTransform={draftTransform}
        onDraftChange={setDraftTransform}
        getVideoElement={getVideoElement}
        getImageElement={(url) => getImageElement(url)}
        requireLogin={requireLogin}
        onTracksMutate={onTracksMutate}
        setSelectedClipId={setSelectedClipId}
        textEditing={textEditing}
        previewTextPlaceholder={emptyPreview}
        draftText={draftText}
        onTextClipDoubleClick={handleTextClipDoubleClick}
      />
      <StudioClipInlineTextEdit
        ref={textEditRef}
        projectId={projectId}
        canvasRef={canvasRef}
        canvasSize={size}
        selectedClip={selectedClip}
        playheadSec={playheadSec}
        isPlaying={isPlaying}
        draftTransform={draftTransform}
        draftText={draftText}
        onDraftTextChange={setDraftText}
        onEditingChange={setTextEditing}
        requireLogin={requireLogin}
        onTracksMutate={onTracksMutate}
      />
      {layers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("studioPreview")}</p>
      ) : null}
    </section>
  );
}
);

export default StudioPreviewPlayer;

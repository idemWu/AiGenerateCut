import { sortTracksForRender } from "@/lib/studio/playback/resolveClipsAtTime";
import {
  getExportCanvasSize,
  prepareExportMedia,
  renderExportFrame,
  type ExportTimelineOptions,
} from "./exportTimelineShared";
import type { VideoEncoderConfigResult } from "./resolveVideoEncoderConfig";

// 编码队列堆到这个深度就让出事件循环一次，给主线程消化编码 + 刷 UI。
const ENCODE_QUEUE_HIGH_WATER = 4;

function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function exportTimelineMp4WebCodecs(
  options: ExportTimelineOptions,
  encoderConfig: VideoEncoderConfigResult
): Promise<Blob> {
  const { tracks, durationSec, aspectRatio, fps = 30, onProgress, signal } = options;
  const size = getExportCanvasSize(aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  onProgress?.({ phase: "prepare", progress: 0, compatMode: false });

  const maps = await prepareExportMedia(
    tracks,
    (loaded, total) => onProgress?.({ phase: "prepare", progress: loaded / total }),
    signal
  );

  const sortedTracks = sortTracksForRender(tracks);

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: "avc",
      width: size.width,
      height: size.height,
    },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderError = e;
    },
  });

  encoder.configure({
    codec: encoderConfig.codec,
    width: encoderConfig.width,
    height: encoderConfig.height,
    bitrate: encoderConfig.bitrate,
    framerate: encoderConfig.framerate,
    hardwareAcceleration: encoderConfig.hardwareAcceleration,
  });

  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException("Aborted", "AbortError");
    }
    if (encoderError) throw encoderError;

    const t = frameIndex / fps;
    await renderExportFrame(ctx, size, sortedTracks, t, maps);

    const frame = new VideoFrame(canvas, { timestamp: (frameIndex * 1_000_000) / fps });
    encoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
    frame.close();

    onProgress?.({
      phase: "encode",
      progress: (frameIndex + 1) / totalFrames,
      compatMode: false,
    });

    if (encoder.encodeQueueSize > ENCODE_QUEUE_HIGH_WATER) {
      await yieldToEventLoop();
    }
  }

  await encoder.flush();
  encoder.close();
  onProgress?.({ phase: "mux", progress: 1, compatMode: false });
  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}

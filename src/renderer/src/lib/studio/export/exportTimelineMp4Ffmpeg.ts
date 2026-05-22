import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import ffmpegCoreUrl from "@ffmpeg/core?url";
import ffmpegCoreWasmUrl from "@ffmpeg/core/wasm?url";
import { sortTracksForRender } from "@/lib/studio/playback/resolveClipsAtTime";
import {
  canvasToJpegBlob,
  getExportCanvasSize,
  prepareExportMedia,
  renderExportFrame,
  type ExportTimelineOptions,
} from "./exportTimelineShared";

let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function loadFfmpeg(
  onLoadProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLoadProgress) {
      ffmpeg.on("progress", ({ progress }) => onLoadProgress(progress));
    }
    await ffmpeg.load({
      coreURL: ffmpegCoreUrl,
      wasmURL: ffmpegCoreWasmUrl,
    });
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

export async function exportTimelineMp4Ffmpeg(options: ExportTimelineOptions): Promise<Blob> {
  const { tracks, durationSec, aspectRatio, fps = 30, onProgress, signal } = options;
  const size = getExportCanvasSize(aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  onProgress?.({ phase: "loadWasm", progress: 0, compatMode: true });

  const ffmpeg = await loadFfmpeg((ratio) => {
    onProgress?.({ phase: "loadWasm", progress: Math.min(1, ratio), compatMode: true });
  });

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  onProgress?.({ phase: "prepare", progress: 0, compatMode: true });

  const maps = await prepareExportMedia(
    tracks,
    (loaded, total) =>
      onProgress?.({ phase: "prepare", progress: loaded / total, compatMode: true }),
    signal
  );

  const sortedTracks = sortTracksForRender(tracks);
  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
  const framePattern = "frame_%05d.jpg";

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const t = frameIndex / fps;
    await renderExportFrame(ctx, size, sortedTracks, t, maps);

    const blob = await canvasToJpegBlob(canvas);
    const name = framePattern.replace("%05d", String(frameIndex + 1).padStart(5, "0"));
    await ffmpeg.writeFile(name, await fetchFile(blob));

    onProgress?.({
      phase: "encode",
      progress: (frameIndex + 1) / totalFrames,
      compatMode: true,
    });
  }

  onProgress?.({ phase: "mux", progress: 0, compatMode: true });

  await ffmpeg.exec([
    "-framerate",
    String(fps),
    "-i",
    framePattern,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "out.mp4",
  ]);

  const data = await ffmpeg.readFile("out.mp4");
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

  for (let i = 1; i <= totalFrames; i++) {
    const name = framePattern.replace("%05d", String(i).padStart(5, "0"));
    await ffmpeg.deleteFile(name);
  }
  await ffmpeg.deleteFile("out.mp4");

  onProgress?.({ phase: "mux", progress: 1, compatMode: true });

  const mp4Bytes = Uint8Array.from(bytes);
  return new Blob([mp4Bytes], { type: "video/mp4" });
}

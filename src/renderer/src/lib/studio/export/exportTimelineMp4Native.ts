import { sortTracksForRender } from "@/lib/studio/playback/resolveClipsAtTime";
import {
  canvasToRawRgba,
  getExportCanvasSize,
  prepareExportMedia,
  renderExportFrame,
  type ExportTimelineOptions,
} from "./exportTimelineShared";

export interface NativeExportResult {
  outputPath: string;
}

const DEBUG_STUDIO_EXPORT =
  typeof localStorage !== "undefined" && localStorage.getItem("studioExportDebug") === "1";

function logNativeExport(message: string, payload?: unknown): void {
  if (!DEBUG_STUDIO_EXPORT) return;
  if (payload === undefined) {
    console.log(`[StudioExport][Renderer] ${message}`);
    return;
  }
  console.log(`[StudioExport][Renderer] ${message}`, payload);
}

/**
 * 通过 Electron 主进程的原生 FFmpeg 导出 MP4。
 * Renderer 负责 Canvas 合成与 Raw RGBA 帧的产出；编码与保存对话框在主进程完成。
 */
export async function exportTimelineMp4Native(
  options: ExportTimelineOptions
): Promise<NativeExportResult> {
  const { tracks, durationSec, aspectRatio, fps = 30, onProgress, signal } = options;
  const api = window.studioExport;
  if (!api) throw new Error("Native export bridge not available");

  const size = getExportCanvasSize(aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  // 导出 Native 路径每帧都会 getImageData 读取 RGBA，提示浏览器优先优化读回性能。
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not available");

  logNativeExport("开始 Native 导出", {
    size: `${size.width}x${size.height}`,
    fps,
    durationSec,
  });
  onProgress?.({ phase: "prepare", progress: 0, nativeMode: true });

  const maps = await prepareExportMedia(
    tracks,
    (loaded, total) =>
      onProgress?.({ phase: "prepare", progress: loaded / total, nativeMode: true }),
    signal
  );

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  logNativeExport("素材预加载完成");

  const sortedTracks = sortTracksForRender(tracks);
  const totalFrames = Math.max(1, Math.ceil(durationSec * fps));

  const { exportId } = await api.start({
    width: size.width,
    height: size.height,
    fps,
    totalFrames,
    defaultFilename: options.defaultFilename ?? "studio-export.mp4",
  });
  logNativeExport("主进程 session 已创建", { exportId, totalFrames });

  // 进度推送：主进程 mux 阶段通过 onProgress 事件下发
  api.onProgress((payload) => {
    onProgress?.({
      phase: payload.phase,
      progress: payload.progress,
      nativeMode: true,
    });
  });

  // 取消处理：abort 时通知主进程清理 session、kill ffmpeg
  let abortHandler: (() => void) | null = null;
  if (signal) {
    abortHandler = () => {
      logNativeExport("收到取消信号，通知主进程清理", { exportId });
      void api.cancel(exportId).catch(() => {
        /* 取消时主进程可能已完成清理，这里忽略重复取消错误。 */
      });
    };
    signal.addEventListener("abort", abortHandler, { once: true });
  }

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const t = frameIndex / fps;
      await renderExportFrame(ctx, size, sortedTracks, t, maps);
      const buffer = canvasToRawRgba(canvas);
      await api.writeFrame(exportId, frameIndex, buffer);

      const writtenFrames = frameIndex + 1;
      const milestone = Math.max(1, Math.floor(totalFrames / 4));
      if (writtenFrames === 1 || writtenFrames === totalFrames || writtenFrames % milestone === 0) {
        logNativeExport("Raw 帧已传给主进程", {
          exportId,
          writtenFrames,
          totalFrames,
        });
      }

      onProgress?.({
        phase: "encode",
        progress: (frameIndex + 1) / totalFrames,
        nativeMode: true,
      });
    }

    onProgress?.({ phase: "mux", progress: 0, nativeMode: true });
    logNativeExport("帧传输完成，进入主进程 FFmpeg 编码/保存", { exportId });
    const result = await api.finalize(exportId);

    if ("canceled" in result) {
      logNativeExport("用户取消保存文件", { exportId });
      throw new DOMException("Save canceled", "AbortError");
    }

    onProgress?.({ phase: "mux", progress: 1, nativeMode: true });
    logNativeExport("Native 导出完成", { exportId, outputPath: result.outputPath });
    return { outputPath: result.outputPath };
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    // 异常时尽力清理主进程 session
    logNativeExport("Native 导出异常，通知主进程清理", {
      exportId,
      message: err instanceof Error ? err.message : String(err),
    });
    void api.cancel(exportId).catch(() => {
      /* 清理失败不覆盖原始导出错误。 */
    });
    throw err;
  } finally {
    api.offProgress();
    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

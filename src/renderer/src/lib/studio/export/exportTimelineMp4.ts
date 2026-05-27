import { aspectRatioToCanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import { exportTimelineMp4Ffmpeg } from "./exportTimelineMp4Ffmpeg";
import { exportTimelineMp4Native } from "./exportTimelineMp4Native";
import { exportTimelineMp4WebCodecs } from "./exportTimelineMp4WebCodecs";
import { isElectronExportAvailable } from "./isElectronExportAvailable";
import { resolveVideoEncoderConfig } from "./resolveVideoEncoderConfig";
import type { ExportTimelineOptions } from "./exportTimelineShared";

export type { ExportProgress, ExportTimelineOptions } from "./exportTimelineShared";

export type ExportTimelineResult =
  | { kind: "file"; outputPath: string }
  | { kind: "blob"; blob: Blob };

export function isWebCodecsExportSupported(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** 浏览器内是否可导出 MP4（Native / WebCodecs / FFmpeg.wasm 任一可用） */
export function isStudioExportSupported(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

const DEBUG_STUDIO_EXPORT =
  typeof localStorage !== "undefined" && localStorage.getItem("studioExportDebug") === "1";

function logExportRoute(message: string, payload?: unknown): void {
  if (!DEBUG_STUDIO_EXPORT) return;
  if (payload === undefined) {
    console.log(`[StudioExport][Router] ${message}`);
    return;
  }
  console.log(`[StudioExport][Router] ${message}`, payload);
}

/**
 * 导出 MP4 路由：
 *   1. Electron 主进程 Native FFmpeg（优先，文件路径形式返回）
 *   2. WebCodecs（硬件/软件 H.264，Blob 形式返回）
 *   3. FFmpeg.wasm（兜底，Blob 形式返回）
 */
export async function exportTimelineMp4(
  options: ExportTimelineOptions
): Promise<ExportTimelineResult> {
  if (!isStudioExportSupported()) {
    throw new Error("Export not supported in this environment");
  }

  if (await isElectronExportAvailable()) {
    logExportRoute("命中 Native 路径（Electron 主进程 FFmpeg）");
    const { outputPath } = await exportTimelineMp4Native(options);
    return { kind: "file", outputPath };
  }

  const { aspectRatio, fps = 30 } = options;
  const size = aspectRatioToCanvasSize(aspectRatio);
  const encoderConfig = await resolveVideoEncoderConfig(size, fps);

  if (encoderConfig) {
    logExportRoute("命中 WebCodecs 路径", encoderConfig);
    const blob = await exportTimelineMp4WebCodecs(options, encoderConfig);
    return { kind: "blob", blob };
  }

  logExportRoute("命中 FFmpeg.wasm 兜底路径");
  const blob = await exportTimelineMp4Ffmpeg(options);
  return { kind: "blob", blob };
}

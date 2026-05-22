import { aspectRatioToCanvasSize } from "@/lib/studio/composition/aspectRatioSize";
import { exportTimelineMp4Ffmpeg } from "./exportTimelineMp4Ffmpeg";
import { exportTimelineMp4WebCodecs } from "./exportTimelineMp4WebCodecs";
import { resolveVideoEncoderConfig } from "./resolveVideoEncoderConfig";

export type { ExportProgress, ExportTimelineOptions } from "./exportTimelineShared";

export function isWebCodecsExportSupported(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** 浏览器内是否可导出 MP4（WebCodecs 或 FFmpeg.wasm） */
export function isStudioExportSupported(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

import type { ExportTimelineOptions } from "./exportTimelineShared";

export async function exportTimelineMp4(options: ExportTimelineOptions): Promise<Blob> {
  if (!isStudioExportSupported()) {
    throw new Error("Export not supported in this environment");
  }

  const { aspectRatio, fps = 30 } = options;
  const size = aspectRatioToCanvasSize(aspectRatio);
  const encoderConfig = await resolveVideoEncoderConfig(size, fps);

  if (encoderConfig) {
    return exportTimelineMp4WebCodecs(options, encoderConfig);
  }

  return exportTimelineMp4Ffmpeg(options);
}

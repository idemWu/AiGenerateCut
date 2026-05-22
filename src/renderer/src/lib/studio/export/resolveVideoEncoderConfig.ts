import type { CanvasSize } from "@/lib/studio/composition/aspectRatioSize";

export interface VideoEncoderConfigResult {
  codec: string;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  hardwareAcceleration?: "prefer-hardware" | "no-preference" | "prefer-software";
}

const CODEC_CANDIDATES = [
  "avc1.640028",
  "avc1.640032",
  "avc1.4D401F",
  "avc1.42E01E",
] as const;

function estimateBitrate(width: number, height: number, fps: number): number {
  return Math.min(8_000_000, Math.max(2_000_000, Math.round(width * height * fps * 0.08)));
}

/** 为当前画布尺寸探测可用的 WebCodecs H.264 配置；无则返回 null */
export async function resolveVideoEncoderConfig(
  size: CanvasSize,
  fps: number
): Promise<VideoEncoderConfigResult | null> {
  if (typeof VideoEncoder === "undefined") return null;

  const bitrate = estimateBitrate(size.width, size.height, fps);
  const base = {
    width: size.width,
    height: size.height,
    bitrate,
    framerate: fps,
  };

  for (const codec of CODEC_CANDIDATES) {
    try {
      const hw = await VideoEncoder.isConfigSupported({
        ...base,
        codec,
        hardwareAcceleration: "prefer-hardware",
      });
      if (hw.supported) {
        return {
          codec: hw.config?.codec ?? codec,
          width: hw.config?.width ?? size.width,
          height: hw.config?.height ?? size.height,
          bitrate: hw.config?.bitrate ?? bitrate,
          framerate: hw.config?.framerate ?? fps,
          hardwareAcceleration: "prefer-hardware",
        };
      }

      const sw = await VideoEncoder.isConfigSupported({ ...base, codec });
      if (sw.supported) {
        return {
          codec: sw.config?.codec ?? codec,
          width: sw.config?.width ?? size.width,
          height: sw.config?.height ?? size.height,
          bitrate: sw.config?.bitrate ?? bitrate,
          framerate: sw.config?.framerate ?? fps,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

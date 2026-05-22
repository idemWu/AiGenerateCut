import type { components } from "@/lib/api/schema";

type StudioAspectRatio = components["schemas"]["StudioAspectRatio"];

export interface CanvasSize {
  width: number;
  height: number;
}

const BASE_WIDTH = 1920;

const RATIO_MAP: Record<StudioAspectRatio, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  "21:9": 21 / 9,
};

export function aspectRatioToCanvasSize(aspectRatio: StudioAspectRatio): CanvasSize {
  const ratio = RATIO_MAP[aspectRatio] ?? 16 / 9;
  const width = BASE_WIDTH;
  const height = Math.round(width / ratio);
  return { width, height };
}

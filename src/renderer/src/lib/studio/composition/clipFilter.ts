import type { StudioClipResponse } from "@/lib/api/studio";

export type StudioClipFilterPreset = "filmWarm" | "vintageFade" | "kodak";

export interface StudioClipFilter {
  preset: StudioClipFilterPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  hue: number;
  blur: number;
}

export interface StudioClipFilterPresetOption {
  id: StudioClipFilterPreset;
  labelKey:
    | "studioFilterFilmWarm"
    | "studioFilterVintageFade"
    | "studioFilterKodak";
  descriptionKey:
    | "studioFilterFilmWarmDesc"
    | "studioFilterVintageFadeDesc"
    | "studioFilterKodakDesc";
  filter: StudioClipFilter;
}

export const STUDIO_CLIP_FILTER_PRESETS: StudioClipFilterPresetOption[] = [
  {
    id: "filmWarm",
    labelKey: "studioFilterFilmWarm",
    descriptionKey: "studioFilterFilmWarmDesc",
    filter: {
      preset: "filmWarm",
      brightness: 1.04,
      contrast: 1.08,
      saturation: 1.12,
      sepia: 0.16,
      hue: -4,
      blur: 0,
    },
  },
  {
    id: "vintageFade",
    labelKey: "studioFilterVintageFade",
    descriptionKey: "studioFilterVintageFadeDesc",
    filter: {
      preset: "vintageFade",
      brightness: 1.08,
      contrast: 0.88,
      saturation: 0.72,
      sepia: 0.28,
      hue: -8,
      blur: 0,
    },
  },
  {
    id: "kodak",
    labelKey: "studioFilterKodak",
    descriptionKey: "studioFilterKodakDesc",
    filter: {
      preset: "kodak",
      brightness: 1.03,
      contrast: 1.16,
      saturation: 1.24,
      sepia: 0.1,
      hue: -2,
      blur: 0,
    },
  },
];

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function getTransformRecord(clip: StudioClipResponse): Record<string, unknown> | null {
  const raw = clip.transform;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

export function readClipFilter(clip: StudioClipResponse): StudioClipFilter | null {
  const transform = getTransformRecord(clip);
  const raw = transform?.filter;
  if (!raw || typeof raw !== "object") return null;

  const source = raw as Record<string, unknown>;
  const preset = source.preset;
  if (preset !== "filmWarm" && preset !== "vintageFade" && preset !== "kodak") {
    return null;
  }

  const presetDefaults = STUDIO_CLIP_FILTER_PRESETS.find((item) => item.id === preset)?.filter;
  if (!presetDefaults) return null;

  return {
    preset,
    brightness: clampNumber(source.brightness, presetDefaults.brightness, 0, 3),
    contrast: clampNumber(source.contrast, presetDefaults.contrast, 0, 3),
    saturation: clampNumber(source.saturation, presetDefaults.saturation, 0, 3),
    sepia: clampNumber(source.sepia, presetDefaults.sepia, 0, 1),
    hue: clampNumber(source.hue, presetDefaults.hue, -180, 180),
    blur: clampNumber(source.blur, presetDefaults.blur, 0, 20),
  };
}

export function buildCanvasFilter(filter: StudioClipFilter | null): string {
  if (!filter) return "none";
  return [
    `brightness(${filter.brightness})`,
    `contrast(${filter.contrast})`,
    `saturate(${filter.saturation})`,
    `sepia(${filter.sepia})`,
    `hue-rotate(${filter.hue}deg)`,
    `blur(${filter.blur}px)`,
  ].join(" ");
}

export function filterToApiRecord(filter: StudioClipFilter): { [key: string]: unknown } {
  return {
    preset: filter.preset,
    brightness: Math.round(filter.brightness * 1000) / 1000,
    contrast: Math.round(filter.contrast * 1000) / 1000,
    saturation: Math.round(filter.saturation * 1000) / 1000,
    sepia: Math.round(filter.sepia * 1000) / 1000,
    hue: Math.round(filter.hue * 1000) / 1000,
    blur: Math.round(filter.blur * 1000) / 1000,
  };
}


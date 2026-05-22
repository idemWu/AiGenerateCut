export const TIMELINE_ZOOM_MIN = 40;
export const TIMELINE_ZOOM_MAX = 200;
export const TIMELINE_ZOOM_STEP = 5;

export function clampTimelineZoom(zoom: number): number {
  return Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, zoom));
}

export function nudgeTimelineZoom(zoom: number, delta: number): number {
  return clampTimelineZoom(zoom + delta);
}

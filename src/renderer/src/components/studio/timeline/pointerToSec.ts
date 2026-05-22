const SNAP_SEC = 0.1;

export interface PointerToSecParams {
  clientX: number;
  canvasLeft: number;
  scrollLeft: number;
  pxPerSec: number;
  durationSec: number;
  snap?: boolean;
}

export function pointerToSec(params: PointerToSecParams): number {
  const { clientX, canvasLeft, scrollLeft, pxPerSec, durationSec, snap = true } =
    params;
  const x = clientX - canvasLeft + scrollLeft;
  let sec = x / pxPerSec;
  sec = Math.max(0, Math.min(durationSec, sec));
  if (snap) {
    sec = Math.round(sec / SNAP_SEC) * SNAP_SEC;
  }
  return Math.round(sec * 1000) / 1000;
}

export function formatTimelineTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 10);
  if (m > 0) {
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (f > 0) {
    return `${s}.${f}s`;
  }
  return `${s}s`;
}

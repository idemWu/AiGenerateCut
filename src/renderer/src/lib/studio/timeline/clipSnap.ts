import type { StudioTimelineTrackResponse } from "@/lib/api/studio";

export const SNAP_THRESHOLD_SEC = 0.15;

/** 根据缩放换算吸附阈值（约 12px） */
export function snapThresholdSec(pxPerSec: number): number {
  return Math.max(SNAP_THRESHOLD_SEC, 12 / pxPerSec);
}

export function hasOverlapOnTrack(
  track: StudioTimelineTrackResponse,
  clipId: number,
  startSec: number,
  durationSec: number
): boolean {
  return hasOverlapOnTrackExcluding(track, new Set([clipId]), startSec, durationSec);
}

export function hasOverlapOnTrackExcluding(
  track: StudioTimelineTrackResponse,
  excludedClipIds: ReadonlySet<number>,
  startSec: number,
  durationSec: number
): boolean {
  const start = Math.max(0, startSec);
  const endSec = start + durationSec;
  for (const other of track.clips ?? []) {
    if (excludedClipIds.has(other.id)) continue;
    if (start < other.end_sec && other.start_sec < endSec) return true;
  }
  return false;
}

/** 在阈值内吸附到邻接 clip 边缘；仅当吸附后无重叠时生效 */
export function snapClipStart(
  track: StudioTimelineTrackResponse,
  clipId: number,
  candidateStartSec: number,
  durationSec: number,
  pxPerSec?: number
): number {
  const start = Math.max(0, candidateStartSec);
  const threshold = pxPerSec != null ? snapThresholdSec(pxPerSec) : SNAP_THRESHOLD_SEC;
  const snapPoints: number[] = [0];

  for (const other of track.clips ?? []) {
    if (other.id === clipId) continue;
    snapPoints.push(other.end_sec);
    snapPoints.push(other.start_sec - durationSec);
  }

  let best = start;
  let bestDist = threshold + 1;

  for (const point of snapPoints) {
    const snapped = Math.max(0, point);
    const dist = Math.abs(snapped - start);
    if (dist > threshold || dist >= bestDist) continue;
    if (!hasOverlapOnTrack(track, clipId, snapped, durationSec)) {
      best = snapped;
      bestDist = dist;
    }
  }

  return best;
}

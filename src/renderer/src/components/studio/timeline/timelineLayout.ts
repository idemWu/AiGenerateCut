/** 时间线轨道行高（px） */
export const TRACK_ROW_HEIGHT = 40;

/** 轨道行间距，与 Tailwind mb-2 一致 */
export const TRACK_GAP = 8;

/** 刻度尺高度（px） */
export const RULER_HEIGHT = 34;

/** 轨道路标列宽（px） */
export const TRACK_LABEL_WIDTH = 96;

export function trackRowStride(): number {
  return TRACK_ROW_HEIGHT + TRACK_GAP;
}

export function trackAreaTop(trackIndex: number): number {
  return RULER_HEIGHT + trackIndex * trackRowStride();
}

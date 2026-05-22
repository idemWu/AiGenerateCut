export interface TimeRulerTick {
  sec: number;
  leftPx: number;
  label: string;
  isMajor: boolean;
}

export interface RulerSteps {
  majorStepSec: number;
  minorStepSec: number;
  minorStepPx: number;
  majorStepPx: number;
}

function formatRulerLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m > 0) {
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${s}s`;
}

/** 根据可视宽度选择合适的主刻度间隔（秒） */
function pickMajorStepSec(pxPerSec: number): number {
  const targetPx = 48;
  const raw = targetPx / pxPerSec;
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) {
    if (c >= raw) return c;
  }
  return candidates[candidates.length - 1] ?? 30;
}

export function getRulerSteps(pxPerSec: number): RulerSteps {
  const majorStepSec = pickMajorStepSec(pxPerSec);
  const minorDivisions = majorStepSec >= 10 ? 5 : majorStepSec >= 5 ? 5 : 4;
  const minorStepSec = majorStepSec / minorDivisions;
  return {
    majorStepSec,
    minorStepSec,
    minorStepPx: minorStepSec * pxPerSec,
    majorStepPx: majorStepSec * pxPerSec,
  };
}

export function buildTimeRulerTicks(
  durationSec: number,
  pxPerSec: number,
  layoutWidthPx?: number
): TimeRulerTick[] {
  const { majorStepSec, minorStepSec } = getRulerSteps(pxPerSec);
  const ticks: TimeRulerTick[] = [];
  const layoutEndSec = layoutWidthPx != null ? layoutWidthPx / pxPerSec : durationSec;
  const end = Math.max(durationSec, layoutEndSec, majorStepSec);

  for (let sec = 0; sec <= end + 0.001; sec += minorStepSec) {
    const rounded = Math.round(sec * 100) / 100;
    const isMajor = Math.abs(rounded % majorStepSec) < 0.05 || rounded === 0;
    ticks.push({
      sec: rounded,
      leftPx: rounded * pxPerSec,
      label: isMajor && rounded <= durationSec + 0.01 ? formatRulerLabel(rounded) : "",
      isMajor,
    });
  }

  return ticks;
}

/** 主刻度区间背景条（剪映风交替色带） */
export function buildMajorRulerBands(
  durationSec: number,
  pxPerSec: number,
  layoutWidthPx: number
): { leftPx: number; widthPx: number }[] {
  const { majorStepSec } = getRulerSteps(pxPerSec);
  const end = Math.max(durationSec, layoutWidthPx / pxPerSec);
  const bands: { leftPx: number; widthPx: number }[] = [];
  let i = 0;
  for (let sec = 0; sec < end - 0.001; sec += majorStepSec) {
    if (i % 2 === 0) {
      bands.push({
        leftPx: sec * pxPerSec,
        widthPx: majorStepSec * pxPerSec,
      });
    }
    i += 1;
  }
  return bands;
}

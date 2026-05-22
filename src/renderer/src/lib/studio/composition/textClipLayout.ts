import type { CanvasSize } from "./aspectRatioSize";
import type { SourceSize } from "./clipTransform";

export const TEXT_CLIP_FONT =
  "600 48px Inter, PingFang SC, Microsoft YaHei, sans-serif";
export const TEXT_CLIP_LINE_HEIGHT = 56;
export const TEXT_CLIP_MAX_LINE_WIDTH_RATIO = 0.85;
export const TEXT_CLIP_PADDING = 24;

function wrapLongRun(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [""];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export function layoutTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para && !/\s/.test(para) && ctx.measureText(para).width > maxWidth) {
      lines.push(...wrapLongRun(ctx, para, maxWidth));
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length === 0) lines.push("");
  return lines;
}

export interface TextClipLayoutMetrics {
  sourceSize: SourceSize;
  lines: string[];
  lineCount: number;
  contentHeight: number;
}

export function computeTextClipLayoutMetrics(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasSize: CanvasSize
): TextClipLayoutMetrics {
  const maxLineWidth = canvasSize.width * TEXT_CLIP_MAX_LINE_WIDTH_RATIO;
  ctx.font = TEXT_CLIP_FONT;
  const lines = layoutTextLines(ctx, text, maxLineWidth);
  let maxW = 0;
  for (const ln of lines) {
    maxW = Math.max(maxW, ctx.measureText(ln || " ").width);
  }
  const lineCount = Math.max(lines.length, 1);
  const contentHeight = lineCount * TEXT_CLIP_LINE_HEIGHT;
  return {
    sourceSize: {
      width: Math.min(maxLineWidth, maxW + TEXT_CLIP_PADDING * 2),
      height: contentHeight + TEXT_CLIP_PADDING * 2,
    },
    lines,
    lineCount,
    contentHeight,
  };
}

export function measureTextClipSourceSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasSize: CanvasSize
): SourceSize {
  return computeTextClipLayoutMetrics(ctx, text, canvasSize).sourceSize;
}

export function drawTextLinesInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxWidth: number,
  boxHeight: number,
  fillStyle: string
): void {
  const maxWidth = boxWidth * 0.95;
  ctx.font = TEXT_CLIP_FONT;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = layoutTextLines(ctx, text, maxWidth);
  const totalHeight = lines.length * TEXT_CLIP_LINE_HEIGHT;
  let cy = boxHeight / 2 - totalHeight / 2 + TEXT_CLIP_LINE_HEIGHT / 2;
  for (const ln of lines) {
    ctx.fillText(ln, boxWidth / 2, cy);
    cy += TEXT_CLIP_LINE_HEIGHT;
  }
}

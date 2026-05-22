import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化大数字为紧凑形式（如 109.2万 / 1.1M）
 */
export function formatCompactNumber(
  n: number,
  lang: "en" | "zh" | "ja" = "zh"
): string {
  if (!Number.isFinite(n) || n < 0) return "0"
  if (n < 10000) return String(Math.floor(n))

  const localeMap = {
    zh: "zh-CN",
    en: "en-US",
    ja: "ja-JP",
  } as const

  return new Intl.NumberFormat(localeMap[lang], {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n)
}

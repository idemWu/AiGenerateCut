import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, resolveLocale } from "./config";
import type { Locale } from "./translations";

/** URL 首段合法语言（与 translations 一致） */
export const LOCALE_PREFIXES = ["en", "zh", "ja"] as const;

export type LocalePrefix = (typeof LOCALE_PREFIXES)[number];

export function isLocalePrefix(value: string): value is LocalePrefix {
  return (LOCALE_PREFIXES as readonly string[]).includes(value);
}

/**
 * 站内路径加 locale 前缀，例如 `/videos` + `zh` → `/zh/videos`
 * 已带前缀或外链则原样返回。
 */
export function withLocalePath(locale: Locale, path: string): string {
  void locale;
  if (!path || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const seg = normalized.split("/").filter(Boolean)[0];
  if (seg && isLocalePrefix(seg)) {
    const rest = normalized.split("/").filter(Boolean).slice(1);
    return rest.length ? `/${rest.join("/")}` : "/";
  }
  return normalized;
}

/**
 * 从 pathname（含或不含 locale）解析 locale 与去掉前缀后的路径（始终以 `/` 开头）。
 */
export function splitLocalePathname(pathname: string): {
  locale: Locale;
  pathnameWithoutLocale: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (first && isLocalePrefix(first)) {
    const rest = segments.slice(1);
    const pathnameWithoutLocale = rest.length ? `/${rest.join("/")}` : "/";
    return {
      locale: resolveLocale(first, DEFAULT_LOCALE),
      pathnameWithoutLocale,
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    pathnameWithoutLocale: pathname.startsWith("/") ? pathname : `/${pathname}`,
  };
}

/** 供 Middleware：从 Accept-Language 粗选一个偏好（无则默认） */
export function pickLocaleFromAcceptLanguage(
  acceptLanguage: string | null
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const lowered = acceptLanguage.toLowerCase();
  if (lowered.includes("zh")) return "zh";
  if (lowered.includes("ja")) return "ja";
  if (lowered.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

/** 从 Cookie 头读已存语言 */
export function readLocaleFromCookieHeader(
  cookieHeader: string | null
): Locale | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${LOCALE_COOKIE_KEY}=`)) {
      const value = part.slice(LOCALE_COOKIE_KEY.length + 1);
      return resolveLocale(decodeURIComponent(value), DEFAULT_LOCALE);
    }
  }
  return null;
}

export function localeFromPathOrDefault(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && isLocalePrefix(first)) {
    return resolveLocale(first, DEFAULT_LOCALE);
  }
  return DEFAULT_LOCALE;
}

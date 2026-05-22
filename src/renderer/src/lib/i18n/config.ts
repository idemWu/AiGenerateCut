import type { Locale } from "./translations";

export const LOCALE_STORAGE_KEY = "movie-utopia-locale";
export const LOCALE_COOKIE_KEY = "movie-utopia-locale";
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "zh" || value === "ja";
}

export function resolveLocale(
  value: string | undefined | null,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  return isLocale(value) ? value : fallback;
}

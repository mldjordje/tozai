// Two languages, one tree of routes.
//
// Serbian keeps the bare paths ("/", "/portfolio", "/upit") because those are
// the URLs that are indexed and shared; English lives under "/en". A prefix
// rather than a cookie on purpose: the landing is ISR-cached, and a page whose
// output depends on a cookie cannot be cached at all — every visit would pay
// for the full render and the database reads behind it.

export const LOCALES = ["sr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "sr";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The same path in the given language.
 *
 * Takes the Serbian (bare) form and prefixes it for English. Anything that is
 * not an in-app absolute path — a hash, a full URL, an API route — is returned
 * untouched, so callers can pass hrefs straight through without checking first.
 */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path.startsWith("/api/")) return path;
  // "/#paketi" is a link to a section of the home page, so the prefix goes
  // before the hash rather than in front of the whole string.
  const hash = path.indexOf("#");
  const base = hash === -1 ? path : path.slice(0, hash);
  const rest = hash === -1 ? "" : path.slice(hash);
  // Some browsers/caches expose the home page pathname as "/index" even
  // though the canonical route is "/". Never let that alias become the
  // non-existent English route "/en/index".
  const normalizedBase = base === "/index" || base === "/index.html" ? "/" : base;
  const normalizedPath = `${normalizedBase}${rest}`;
  if (locale === DEFAULT_LOCALE) return normalizedPath;
  const clean = normalizedBase === "/" ? "" : normalizedBase;
  return `/${locale}${clean}${rest}` || `/${locale}`;
}

/** The counterpart path in the other language, for the header switch. */
export function otherLocale(locale: Locale): Locale {
  return locale === "sr" ? "en" : "sr";
}

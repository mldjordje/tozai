import "server-only";
import { getSql } from "@/lib/db";
import {
  landingContentKey,
  landingDefaults,
  mergeLandingContent,
  type LandingContent,
} from "./landing";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

// Server-side read of the admin-written landing copy.
//
// Split from landing.ts because the section components are client components
// and import the schema/defaults from there — pulling `server-only` into that
// module would break the whole page build.
//
// One row per language ("landing", "landing_en"). They are independent: the
// English page falls back to the English defaults, never to the Serbian copy,
// because a page rendering half in each language is worse than one rendering a
// default sentence the studio has not rewritten yet.

/** Raw stored overrides, for the admin editor: it must show what is actually
 *  saved (empty = "uses the default"), not the merged result. */
export async function getLandingOverrides(
  locale: Locale = DEFAULT_LOCALE,
): Promise<Record<string, unknown>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT value FROM site_content WHERE key = ${landingContentKey(locale)}
  `) as { value: Record<string, unknown> }[];
  return rows[0]?.value ?? {};
}

/**
 * Landing-safe, like getPublicContact(): an unreachable database reads as "no
 * overrides" and the page renders its defaults instead of 500-ing. The copy is
 * the last thing that should be able to take the homepage down.
 */
export async function getLandingContent(
  locale: Locale = DEFAULT_LOCALE,
): Promise<LandingContent> {
  const base = landingDefaults(locale);
  try {
    return mergeLandingContent(await getLandingOverrides(locale), base);
  } catch {
    return base;
  }
}

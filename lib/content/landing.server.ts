import "server-only";
import { getSql } from "@/lib/db";
import { DEFAULTS, mergeLandingContent, type LandingContent } from "./landing";

// Server-side read of the admin-written landing copy.
//
// Split from landing.ts because the section components are client components
// and import the schema/defaults from there — pulling `server-only` into that
// module would break the whole page build.

/** Raw stored overrides, for the admin editor: it must show what is actually
 *  saved (empty = "uses the default"), not the merged result. */
export async function getLandingOverrides(): Promise<Record<string, unknown>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT value FROM site_content WHERE key = 'landing'
  `) as { value: Record<string, unknown> }[];
  return rows[0]?.value ?? {};
}

/**
 * Landing-safe, like getPublicContact(): an unreachable database reads as "no
 * overrides" and the page renders its defaults instead of 500-ing. The copy is
 * the last thing that should be able to take the homepage down.
 */
export async function getLandingContent(): Promise<LandingContent> {
  try {
    return mergeLandingContent(await getLandingOverrides());
  } catch {
    return DEFAULTS;
  }
}

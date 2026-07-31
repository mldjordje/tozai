import "server-only";
import { getSql } from "@/lib/db";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

// The proof rail on the landing (#portfolio). Rows are uploaded from
// /admin/rezultati; the section renders whatever is active, in `sort` order.

export type ResultShot = {
  id: number;
  image_url: string;
  alt: string;
  handle: string;
  stat: string;
  width: number | null;
  height: number | null;
  wide: boolean;
};

/** Fallback aspect ratios for rows uploaded before the browser could measure
 *  them (or pasted as a bare URL). Matches the two card widths the rail uses,
 *  so a missing size degrades to the old hard-coded behaviour instead of a
 *  layout jump. */
export const FALLBACK_SIZE = {
  wide: { width: 1358, height: 1158 },
  tall: { width: 853, height: 1846 },
} as const;

export function shotSize(shot: Pick<ResultShot, "width" | "height" | "wide">) {
  const fallback = shot.wide ? FALLBACK_SIZE.wide : FALLBACK_SIZE.tall;
  return {
    width: shot.width ?? fallback.width,
    height: shot.height ?? fallback.height,
  };
}

// The link preview used to be the first shot of this rail — an Instagram
// profile screenshot, follower count and all. It is now drawn from the brand
// instead (app/opengraph-image.tsx), so there is no cover helper here any more.
// The screenshots stay where they belong: on the page, in context, under the
// line about past results.

/**
 * Landing-safe: an unreachable database reads as "no shots" and the section
 * renders its static fallback rather than taking the homepage down.
 */
export async function getPublicResultShots(
  locale: Locale = DEFAULT_LOCALE,
): Promise<ResultShot[]> {
  try {
    const sql = getSql();
    // `handle` is a username — the one field on the card that must not be
    // translated, in either direction.
    const columns =
      locale === "en"
        ? `COALESCE(NULLIF(btrim(alt_en), ''), alt) AS alt,
           COALESCE(NULLIF(btrim(stat_en), ''), stat) AS stat`
        : `alt, stat`;
    return (await sql.query(`
      SELECT id, image_url, ${columns}, handle, width, height, wide
      FROM result_shots
      WHERE active
      ORDER BY sort, id
    `)) as ResultShot[];
  } catch {
    return [];
  }
}

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

/** The link-preview (og:image) cover, used when the DB has no active rows or is
 *  unreachable. Mirrors the first entry of the static rail in
 *  components/sections/ResultsShowcase.tsx, so the preview shows the same shot
 *  the visitor sees first either way. Relative — metadataBase in app/layout.tsx
 *  makes it absolute. */
const FALLBACK_COVER = {
  url: "/media/results/ig-toza.png",
  alt: "toza.aii — Instagram profil, 187K pratilaca, verifikovan",
  ...FALLBACK_SIZE.wide,
} as const;

/**
 * The first shot of the proof rail, as an og:image.
 *
 * Chats and social cards fetch one image, and until now there was none — a
 * shared link rendered as a bare grey box. It reads the same query the section
 * does, so whatever the admin sorts to the front of /admin/rezultati becomes
 * the cover with no second place to update.
 */
export async function getLandingCover(locale: Locale = DEFAULT_LOCALE) {
  const [first] = await getPublicResultShots(locale);
  if (!first) return FALLBACK_COVER;
  return { url: first.image_url, alt: first.alt, ...shotSize(first) };
}

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

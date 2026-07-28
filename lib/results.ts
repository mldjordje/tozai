import "server-only";
import { getSql } from "@/lib/db";

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

/**
 * Landing-safe: an unreachable database reads as "no shots" and the section
 * renders its static fallback rather than taking the homepage down.
 */
export async function getPublicResultShots(): Promise<ResultShot[]> {
  try {
    const sql = getSql();
    return (await sql`
      SELECT id, image_url, alt, handle, stat, width, height, wide
      FROM result_shots
      WHERE active
      ORDER BY sort, id
    `) as ResultShot[];
  } catch {
    return [];
  }
}

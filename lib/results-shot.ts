/**
 * The public slice of `result_shots`, plus the two helpers the landing rail and
 * its lightbox both need.
 *
 * Client-safe on purpose: lib/results.ts is `server-only`, so anything the
 * browser renders has to share this module instead — otherwise the database
 * client follows the type into the bundle.
 */

export type ResultShotView = {
  id?: number;
  image_url: string;
  alt: string;
  handle: string;
  stat: string;
  width?: number | null;
  height?: number | null;
  wide: boolean;
};

/** Mirrors shotSize() in lib/results.ts — the fallbacks match the two card
 *  shapes the rail lays out, so a row uploaded before the browser could measure
 *  it degrades to the old aspect ratio instead of jumping the layout. */
export function shotSize(shot: Pick<ResultShotView, "width" | "height" | "wide">) {
  const fallback = shot.wide ? { width: 1358, height: 1158 } : { width: 853, height: 1846 };
  return { width: shot.width ?? fallback.width, height: shot.height ?? fallback.height };
}

/**
 * The heading for a shot.
 *
 * `handle` is optional in the admin form and several live rows leave it blank —
 * a card whose heading is an empty string reads as a broken lightbox, so the
 * stat (and failing that the alt text) stands in.
 */
export function shotTitle(shot: Pick<ResultShotView, "handle" | "stat" | "alt">) {
  return shot.handle?.trim() || shot.stat?.trim() || shot.alt?.trim() || "";
}

/**
 * The lightbox body text.
 *
 * `alt` is written as a full sentence that opens with the handle
 * ("toza.aii — Instagram profil, 187K pratilaca"), which reads as a stutter
 * directly under a heading that is already the handle. Dropping that prefix
 * leaves the part the reader has not seen yet, and rows whose alt is written
 * some other way come through untouched.
 */
export function shotDescription(shot: Pick<ResultShotView, "alt" | "handle" | "stat">) {
  const alt = shot.alt?.trim() ?? "";
  const title = shotTitle(shot);
  // Nothing left to add once the heading is already the whole alt text.
  if (!alt || !title || alt === title) return "";
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return alt.replace(new RegExp(`^${escaped}\\s*[—–-]\\s*`, "i"), "").trim();
}

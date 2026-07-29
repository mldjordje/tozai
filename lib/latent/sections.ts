/**
 * Scroll windows for the background's seven formations, measured from the DOM.
 *
 * Both fields — the WebGL simulation and the 2D lite field — have to be timed
 * to the same sections, and a section's `hold` is defined by its markup rather
 * than by a constant. Measuring it in one place is what keeps the two fields
 * from drifting apart the first time a section's height changes.
 */

/** Section ids in formation order. */
const SECTION_IDS = ["top", "services", "portfolio", "paketi", "edukacija"] as const;

export function measureSectionRanges(): [number, number][] | null {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return null;
  const vh = window.innerHeight;

  const range = (id: string): [number, number] => {
    const el = document.getElementById(id);
    if (!el) return [0, 0];
    const top = el.getBoundingClientRect().top + window.scrollY;
    // A section taller than the viewport pins its sticky child until the
    // section's bottom reaches the viewport bottom. Sections at or under one
    // viewport collapse to a point and simply cross-fade.
    const pinned = Math.max(0, el.offsetHeight - vh);
    if (process.env.NODE_ENV !== "production" && pinned > 0) {
      // A sticky child taller than the viewport exhausts its travel and scrolls
      // away rather than holding, which silently breaks both the pin and this
      // formation's hold window.
      const sticky = el.firstElementChild as HTMLElement | null;
      const isSticky = sticky && getComputedStyle(sticky).position === "sticky";
      if (sticky && isSticky && sticky.offsetHeight > vh + 1) {
        console.warn(
          `[latent] #${id} is pinned but its content is ${sticky.offsetHeight}px ` +
            `against a ${vh}px viewport — it will scroll away instead of holding.`,
        );
      }
    }
    return [top / max, (top + pinned) / max];
  };

  // Booking's pin carries two formations: the field first collapses to a point,
  // then spells the wordmark. Splitting one hold in two with a gap between them
  // gives the collapse a beat before the reveal.
  const booking = range("booking");
  const span = booking[1] - booking[0];
  const ranges: [number, number][] = SECTION_IDS.map(range);
  ranges.push([booking[0], booking[0] + span * 0.26]);
  ranges.push([booking[0] + span * 0.62, booking[1]]);
  return ranges;
}

/** Normalised document scroll position, 0..1. */
export function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

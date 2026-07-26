import type { ReactNode } from "react";

/**
 * A section that pins while the page keeps scrolling.
 *
 * The section is taller than the viewport and its only child is sticky, so the
 * content holds still for `hold` extra viewports before releasing. That pause
 * is what the background field needs: the particle formation gets a window to
 * actually settle and be read, instead of being permanently mid-morph between
 * the section you just left and the one arriving.
 *
 * LatentBackground measures these heights to derive each formation's hold
 * range, so changing `hold` re-times the background automatically — there is
 * no second place to keep in sync.
 *
 * CONSTRAINT: the content must fit within one viewport. A sticky child taller
 * than its travel exhausts the travel and gets carried off-screen instead of
 * holding, so sections with tall card grids (Paketi, Edukacija) are NOT pinned
 * — they would need a sticky-heading / scrolling-cards split instead.
 * LatentBackground warns in development if a pinned child overflows.
 */
export default function PinnedSection({
  id,
  children,
  hold = 0.9,
  className = "",
}: {
  id: string;
  children: ReactNode;
  /** Extra viewport heights to stay pinned for. 0 disables pinning. */
  hold?: number;
  /** Applied to the sticky inner frame, not the outer scroll track. */
  className?: string;
}) {
  return (
    <section
      id={id}
      className="relative"
      style={{ height: `calc(${1 + hold} * 100svh)` }}
    >
      <div
        className={`sticky top-0 flex min-h-svh items-center px-6 py-24 md:px-12 ${className}`}
      >
        {children}
      </div>
    </section>
  );
}

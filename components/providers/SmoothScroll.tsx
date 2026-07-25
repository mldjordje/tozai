"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

/**
 * App-wide inertial smooth scroll. Lenis updates native window.scrollY, so the
 * scroll-scrubbed video background keeps reading scroll position unchanged —
 * it just arrives eased instead of stepped, which makes the film glide.
 * Disabled automatically for users who prefer reduced motion.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <ReactLenis
      root
      options={{
        lerp: prefersReduced ? 1 : 0.09,
        duration: 1.2,
        smoothWheel: !prefersReduced,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
      }}
    >
      {children}
    </ReactLenis>
  );
}

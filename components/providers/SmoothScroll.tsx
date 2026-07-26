"use client";

import { ReactLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Marketing-site inertial smooth scroll. Lenis updates native window.scrollY, so
 * the scroll-scrubbed video background keeps reading scroll position unchanged —
 * it just arrives eased instead of stepped, which makes the film glide.
 * Disabled automatically for users who prefer reduced motion.
 *
 * The app surfaces (/nalog, /admin) opt out: eased scrolling fights sticky
 * sidebars and makes dense tables feel laggy.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (pathname?.startsWith("/nalog") || pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: prefersReduced ? 1 : 0.09,
        duration: 1.2,
        smoothWheel: !prefersReduced,
        // Leave touch native: the OS momentum scroll is already smooth, and
        // Lenis' experimental touch sync adds lag/jank on iOS. Mobile scrub
        // smoothness comes from throttling video seeks, not from hijacking
        // touch. (syncTouch stays off.)
        wheelMultiplier: 1,
        touchMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  );
}

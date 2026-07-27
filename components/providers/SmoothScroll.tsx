"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import "lenis/dist/lenis.css";

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
      <AnchorScroll />
      {children}
    </ReactLenis>
  );
}

/** The fixed header, so a section's eyebrow doesn't land underneath it. */
const HEADER_OFFSET = 84;

/**
 * Anchor links have to go through Lenis.
 *
 * A native hash jump moves window.scrollY behind Lenis' back; Lenis sees a
 * scroll it did not produce, resyncs to it, and the browser's own
 * `scroll-behavior: smooth` animation keeps writing on top of that — which is
 * why the menu and the in-page CTAs read as dead buttons: the page either
 * refuses to move or snaps and springs back. Handing the target to
 * lenis.scrollTo() makes one animation the only one running, and lets the jump
 * clear the fixed header while it's at it.
 *
 * Delegated from the document so it covers every link on the page, including
 * the ones rendered later.
 */
function AnchorScroll() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const onClick = (event: MouseEvent) => {
      // Never swallow a modified click — those are "open in a new tab".
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      const raw = anchor?.getAttribute("href");
      if (!raw) return;

      // "#paketi" anywhere, and "/#paketi" only when we are already on the
      // landing page — otherwise it is a real navigation.
      const hash = raw.startsWith("#")
        ? raw
        : raw.startsWith("/#") && window.location.pathname === "/"
          ? raw.slice(1)
          : null;
      if (!hash || hash === "#") return;

      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;

      event.preventDefault();
      lenis.scrollTo(target, { offset: -HEADER_OFFSET, duration: 1.25 });
      // Keeps the URL shareable without letting the browser scroll again.
      window.history.replaceState(null, "", hash);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lenis]);

  // A deep link arriving with a hash lands before Lenis is ready and gets
  // undone by the initial sync, so it is replayed once here.
  useEffect(() => {
    if (!lenis || !window.location.hash) return;
    const target = document.getElementById(
      decodeURIComponent(window.location.hash.slice(1)),
    );
    if (!target) return;
    const id = window.setTimeout(
      () => lenis.scrollTo(target, { offset: -HEADER_OFFSET, immediate: true }),
      120,
    );
    return () => window.clearTimeout(id);
  }, [lenis]);

  return null;
}

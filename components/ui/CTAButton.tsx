"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Landing CTA.
 *
 * Four ideas, each one a different sense of the same gesture — the button
 * noticing the cursor — rather than four unrelated effects stacked on a pill:
 *
 *   1. a magnetic lean toward the pointer, springy and small (6px at the edge)
 *   2. a specular spotlight that tracks the pointer across the face
 *   3. the label rolling: the word leaves upward while its copy arrives
 *   4. the arrow swinging from -45deg to 0
 *
 * The pointer position is written straight to CSS custom properties, so tracking
 * it costs two style writes per move and no React render. The magnetic offset is
 * a motion value on a spring, which framer animates off the React tree as well.
 *
 * Both pointer behaviours are switched off for coarse pointers and for reduced
 * motion: there is no cursor to lean toward on a phone, and a button that
 * chases the finger reads as a mis-tap.
 */
export default function CTAButton({
  href,
  children,
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // Underdamped on purpose: the button should overshoot a few tenths of a pixel
  // and settle, which is what makes it feel sprung rather than animated.
  const x = useSpring(mx, { stiffness: 260, damping: 18, mass: 0.35 });
  const y = useSpring(my, { stiffness: 260, damping: 18, mass: 0.35 });

  const fine = useRef<boolean | null>(null);
  const isFine = () => {
    if (fine.current === null) {
      fine.current =
        window.matchMedia("(pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return fine.current;
  };

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      const el = ref.current;
      if (!el || !isFine()) return;
      const r = el.getBoundingClientRect();
      const px = event.clientX - r.left;
      const py = event.clientY - r.top;
      el.style.setProperty("--mx", `${px}px`);
      el.style.setProperty("--my", `${py}px`);
      // Normalized to the half-extent, so the pull is the same fraction of the
      // way to the edge on a small button and a large one.
      mx.set(((px - r.width / 2) / (r.width / 2)) * 6);
      my.set(((py - r.height / 2) / (r.height / 2)) * 4);
    },
    [mx, my],
  );

  const onLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  const sizing = size === "lg" ? "px-9 py-[1.1rem] text-base" : "px-7 py-3.5 text-sm";
  const skin =
    variant === "primary"
      ? "bg-fg text-bg"
      : "border border-line bg-bg-elev/40 text-fg backdrop-blur-md transition-[border-color,background-color] duration-500 hover:border-accent-soft/70 hover:bg-bg-elev/70";

  return (
    <motion.a
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ x, y }}
      className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full font-medium ${sizing} ${skin}`}
    >
      {/* Spotlight. On the light primary it has to darken to read at all; on the
          dark ghost it lifts. Opacity, not display, so it fades on exit. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
          variant === "primary" ? "cta-spot-dark" : "cta-spot"
        }`}
      />

      {/* Rolling label. Two copies in a fixed-height mask: the real one leaves
          upward, the aria-hidden copy arrives from below on the same curve. The
          mask is the line box itself, so nothing has to be measured. */}
      <span className="relative z-10 inline-grid overflow-hidden">
        <span className="transition-transform duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full">
          {children}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 translate-y-full transition-transform duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0"
        >
          {children}
        </span>
      </span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10 h-4 w-4 -rotate-45 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:rotate-0"
        aria-hidden
      >
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </motion.a>
  );
}

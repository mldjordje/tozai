"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Desktop-only cursor companion: a soft accent glow that trails the pointer
 * and blooms over interactive elements. Native cursor stays visible.
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    let raf = 0;
    let x = -100;
    let y = -100;
    let tx = x;
    let ty = y;
    let scale = 1;
    let tScale = 1;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const interactive = (e.target as Element | null)?.closest?.(
        "a, button, [role='button']",
      );
      tScale = interactive ? 2.4 : 1;
    };

    const tick = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      scale += (tScale - scale) * 0.14;
      el.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] h-12 w-12 rounded-full mix-blend-screen"
      style={{
        background:
          "radial-gradient(circle, rgba(108,148,255,0.35) 0%, rgba(46,107,255,0.12) 45%, transparent 70%)",
      }}
    />
  );
}

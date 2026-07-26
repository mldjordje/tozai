"use client";

import { useEffect, useRef, useState } from "react";
import { LatentEngine } from "@/lib/latent/engine";

/**
 * WebGL2 particle field — scroll resolves the latent field.
 *
 * A quarter-million point masses spring toward a per-section formation:
 * latent core, lattice, stream, clusters, network, singularity. Scrolling
 * injects turbulence and the field re-settles into the next form; the cursor
 * pushes it aside and it springs back. Everything else is deliberately still.
 *
 * Fallbacks: one settled frame under prefers-reduced-motion, a CSS gradient
 * when WebGL2 or float render targets are unavailable.
 */
export default function LatentBackground({ onReady }: { onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const engine = new LatentEngine();
    // Mobile GPUs cannot push 262k points; a quarter of the particles at a
    // lower DPR keeps the same read at a fraction of the fill cost.
    const ok = engine.mount(canvas, {
      texDim: coarse ? 256 : 512,
      maxDpr: coarse ? 1 : 1.5,
    });
    if (!ok) {
      setFailed(true);
      onReady?.();
      return;
    }
    onReady?.();
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__latentEngine = engine;
    }

    const scrollProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    // Each formation owns the scroll window during which its section is
    // pinned. Measured from the DOM rather than hard-coded, so changing a
    // section's `hold` re-times the background with no second source of truth.
    const syncSectionRanges = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const vh = window.innerHeight;
      const range = (id: string): [number, number] => {
        const el = document.getElementById(id);
        if (!el) return [0, 0];
        const top = el.getBoundingClientRect().top + window.scrollY;
        // A section taller than the viewport pins its sticky child until the
        // section's bottom reaches the viewport bottom. Sections at or under
        // one viewport collapse to a point and simply cross-fade.
        const pinned = Math.max(0, el.offsetHeight - vh);
        if (process.env.NODE_ENV !== "production" && pinned > 0) {
          // A sticky child taller than the viewport exhausts its travel and
          // scrolls away rather than holding, which silently breaks both the
          // pin and this formation's hold window.
          const sticky = el.firstElementChild as HTMLElement | null;
          // Only a genuinely sticky child can suffer this; an ordinary tall
          // section is just a tall section.
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
      // Booking's pin carries two formations: the field first collapses to a
      // point, then spells the wordmark. Splitting one hold in two with a gap
      // between them gives the collapse a beat before the reveal.
      const booking = range("booking");
      const span = booking[1] - booking[0];
      engine.setSectionRanges([
        range("top"),
        range("services"),
        range("portfolio"),
        range("paketi"),
        range("edukacija"),
        [booking[0], booking[0] + span * 0.26],
        [booking[0] + span * 0.62, booking[1]],
      ]);
    };

    // Keep the field clear of whatever copy is currently on screen. Measured
    // from the live heading rather than hard-coded, since the copy is a left
    // column on most sections and centred on the booking CTA.
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2[aria-label]"),
    );
    const syncCopyRect = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let best: DOMRect | null = null;
      let bestArea = 0;
      for (const el of headings) {
        const r = el.getBoundingClientRect();
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (visible > bestArea) {
          bestArea = visible;
          best = r;
        }
      }
      if (!best || bestArea <= 0) {
        engine.setCopyRect(0, 0, 0, 0, 0);
        return;
      }
      // Pad the box so particles bend around the type rather than grazing it,
      // and fade the effect out as the heading leaves the viewport.
      const padX = vw * 0.03;
      const padY = vh * 0.05;
      engine.setCopyRect(
        Math.max(0, (best.left - padX) / vw),
        Math.max(0, 1 - (best.bottom + padY) / vh),
        Math.min(1, (best.right + padX) / vw),
        Math.min(1, 1 - (best.top - padY) / vh),
        // Capped well below 1: this is meant to open a gap around the type,
        // not to evacuate half the viewport.
        Math.min(0.6, bestArea / (vh * 0.4)),
      );
    };

    syncSectionRanges();

    if (reduce) {
      engine.setPointer(0.62, 0.6);
      syncCopyRect();
      engine.renderOnce(0.05);
      const onResize = () => {
        engine.resize();
        syncSectionRanges();
        engine.renderOnce(0.05);
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        engine.dispose();
      };
    }

    const onScroll = () => {
      engine.setProgress(scrollProgress());
      syncCopyRect();
    };
    const onResize = () => {
      engine.resize();
      syncSectionRanges();
      syncCopyRect();
    };
    const onVisibility = () => (document.hidden ? engine.pause() : engine.resume());

    // Mouse: moving aims the vortex, dragging orbits the field. A press that
    // never really moves is a click, so it fires the shockwave instead —
    // otherwise every attempt to orbit would also detonate the field.
    const minDim = () => Math.min(window.innerWidth, window.innerHeight);
    let down = false;
    let travel = 0;
    let lx = 0;
    let ly = 0;

    const onPointerMove = (e: PointerEvent) => {
      engine.setPointer(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
      if (!down || e.pointerType === "touch") return;
      const dx = (e.clientX - lx) / minDim();
      const dy = -(e.clientY - ly) / minDim();
      travel += Math.hypot(dx, dy);
      engine.dragBy(dx, dy);
      lx = e.clientX;
      ly = e.clientY;
    };
    const onPointerDown = (e: PointerEvent) => {
      down = true;
      travel = 0;
      lx = e.clientX;
      ly = e.clientY;
    };
    const onPointerUp = () => {
      if (down && travel < 0.015) engine.pulse();
      down = false;
    };

    // Touch: a gesture that starts mostly horizontal locks into orbiting; a
    // mostly vertical one stays a normal page scroll. No hijacking.
    let tracking = false;
    let decided = false;
    let orbiting = false;
    let sx = 0;
    let sy = 0;
    let tx = 0;
    let ty = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      tracking = true;
      decided = false;
      orbiting = false;
      sx = tx = e.touches[0].clientX;
      sy = ty = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!decided) {
        const adx = Math.abs(t.clientX - sx);
        const ady = Math.abs(t.clientY - sy);
        if (adx > 8 || ady > 8) {
          decided = true;
          orbiting = adx > ady * 1.2;
        }
      }
      if (decided && orbiting) {
        e.preventDefault();
        engine.dragBy((t.clientX - tx) / minDim(), -(t.clientY - ty) / minDim());
      }
      tx = t.clientX;
      ty = t.clientY;
    };
    const onTouchEnd = () => {
      tracking = false;
    };

    engine.setProgress(scrollProgress());
    syncCopyRect();
    engine.start();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {failed ? (
        <div className="absolute inset-0 [background:radial-gradient(70%_55%_at_72%_38%,rgba(46,107,255,0.10)_0%,transparent_65%)]" />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      )}

      {/* Legibility scrim. Desktop copy sits in the left column so the scrim
          runs left-to-right; portrait copy is full-width with the field below
          it, so there it runs top-to-bottom instead. */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/30 to-bg/5 md:bg-gradient-to-r md:from-bg/70 md:via-bg/10 md:to-transparent" />
    </div>
  );
}

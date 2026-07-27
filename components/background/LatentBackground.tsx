"use client";

import { useEffect, useRef, useState } from "react";
import { LatentEngine } from "@/lib/latent/engine";
import { selectLatentProfile } from "@/lib/latent/quality";

/**
 * WebGL2 particle field — scroll resolves the latent field.
 *
 * A quarter-million point masses spring toward a per-section formation:
 * latent core, lattice, stream, clusters, network, singularity. Scrolling
 * injects turbulence and the field re-settles into the next form; the cursor
 * pushes it aside and it springs back. Everything else is deliberately still.
 *
 * Fallbacks: one settled frame under prefers-reduced-motion, a CSS gradient
 * when WebGL2 or float render targets are unavailable, and the same gradient
 * when the GPU turns out to be a software rasteriser or simply cannot hold a
 * watchable frame rate at the cheapest quality step.
 *
 * Append `?latent=debug` to the URL for an on-page readout of the GPU, the
 * chosen profile and the live frame rate — the only practical way to diagnose a
 * machine you do not have in front of you.
 */
export default function LatentBackground({ onReady }: { onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || failed) return;

    // A context that cannot be created at all reports its reason here and
    // nowhere else; without this the failure is a silent `null`.
    const onCreationError = (event: Event) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[latent] WebGL2 context creation failed:",
          (event as Event & { statusMessage?: string }).statusMessage || "no reason given",
        );
      }
    };
    canvas.addEventListener("webglcontextcreationerror", onCreationError);

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const profile = selectLatentProfile({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      // Reduced motion renders one settled frame, but even that should not
      // synchronously simulate a quarter-million particles 220 times.
      saveData: coarse || reduce || nav.connection?.saveData,
    });

    const engine = new LatentEngine();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      engine.pause();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const ok = engine.mount(canvas, {
      profile,
      // The governor has walked to the bottom of the ladder and still cannot
      // hold a watchable rate. A gradient is a better answer than a slideshow.
      onGiveUp: () => setFailed(true),
    });
    if (!ok) {
      setFailed(true);
      onReady?.();
      return () => {
        canvas.removeEventListener("webglcontextcreationerror", onCreationError);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        engine.dispose();
      };
    }
    onReady?.();
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__latentEngine = engine;
    }

    // Debug readout. Opt-in via ?latent=debug so it costs nothing in normal use
    // but can be read off any machine, including one on the other end of a call.
    let diagTimer = 0;
    if (new URLSearchParams(window.location.search).get("latent") === "debug") {
      const tick = () => {
        const d = engine.getDiagnostics();
        setDiag(
          [
            `profile ${d.profile} · step ${d.step}`,
            `${d.particles.toLocaleString()} particles · ${d.bufferW}x${d.bufferH}`,
            `scale ${d.renderScale} · cap ${d.fpsCap} · ${d.fps} fps`,
            `${d.rendererClass}: ${d.renderer || "unknown"}`,
          ].join("\n"),
        );
      };
      tick();
      diagTimer = window.setInterval(tick, 500);
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
        if (!engine.resize()) {
          setFailed(true);
          return;
        }
        syncSectionRanges();
        engine.renderOnce(0.05);
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.clearInterval(diagTimer);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("webglcontextcreationerror", onCreationError);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        engine.dispose();
      };
    }

    const onScroll = () => {
      engine.setProgress(scrollProgress());
      syncCopyRect();
    };
    const onResize = () => {
      if (!engine.resize()) {
        setFailed(true);
        return;
      }
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
      window.clearInterval(diagTimer);
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
      canvas.removeEventListener("webglcontextcreationerror", onCreationError);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      engine.dispose();
    };
  }, [failed]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {failed ? (
        <div className="latent-fallback absolute inset-0" aria-hidden />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      )}

      {diag ? (
        <pre className="pointer-events-none absolute left-3 top-3 z-50 max-w-[min(92vw,34rem)] whitespace-pre-wrap rounded-md bg-black/75 p-3 font-mono text-[10px] leading-relaxed text-emerald-300">
          {diag}
        </pre>
      ) : null}

      {/* Legibility scrim, and the ONLY one — sections must not add their own.
          Two stacked gradients multiply, which is how the field ended up
          reading as almost black behind the hero copy.

          Desktop copy sits in the left column so the scrim runs left-to-right
          and reaches transparent well before the form, which lives right of
          centre in every shot; portrait copy is full-width with the field below
          it, so there it runs top-to-bottom instead. Darkening the left end is
          therefore free — it buys the headline its contrast without touching a
          single lit particle. */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/30 to-bg/5 md:bg-gradient-to-r md:from-bg/80 md:via-bg/16 md:to-transparent" />
    </div>
  );
}

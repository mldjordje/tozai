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

    const syncSectionAnchors = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pageTop = (id: string) => {
        const section = document.getElementById(id);
        return section ? section.getBoundingClientRect().top + window.scrollY : 0;
      };
      // The proof section is intentionally 320svh and sticky, so its formation
      // lands once the horizontal showcase is established rather than at the
      // long section's leading edge.
      engine.setSectionAnchors([
        0,
        pageTop("services") / max,
        (pageTop("portfolio") + window.innerHeight * 0.72) / max,
        pageTop("paketi") / max,
        pageTop("edukacija") / max,
        1,
      ]);
    };

    syncSectionAnchors();

    if (reduce) {
      engine.setPointer(0.62, 0.6);
      engine.renderOnce(0.05);
      const onResize = () => {
        engine.resize();
        syncSectionAnchors();
        engine.renderOnce(0.05);
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        engine.dispose();
      };
    }

    const onScroll = () => engine.setProgress(scrollProgress());
    const onPointer = (e: PointerEvent) =>
      engine.setPointer(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    const onDown = () => engine.pulse();
    const onResize = () => {
      engine.resize();
      syncSectionAnchors();
    };
    const onVisibility = () => (document.hidden ? engine.pause() : engine.resume());

    engine.setProgress(scrollProgress());
    engine.start();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
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

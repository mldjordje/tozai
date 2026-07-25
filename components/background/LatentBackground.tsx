"use client";

import { useEffect, useRef, useState } from "react";
import { LatentEngine } from "@/lib/latent/engine";

/**
 * WebGL "latent field + liquid chrome" background — scroll renders the prompt.
 *
 * Top of page: raw latent noise (diffusion chaos). Scrolling denoises the
 * field into ordered, laminar light; the booking CTA lands on a calm, warm
 * grade. A raymarched liquid-metal sculpture travels across sections and
 * morphs; scroll velocity smears it and accelerates the whole scene.
 * Pointer movement bends the field locally and carries light.
 *
 * Fallbacks: static frame under prefers-reduced-motion, CSS gradient when
 * WebGL2 is unavailable.
 */
export default function LatentBackground({
  onReady,
}: {
  onReady?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const engine = new LatentEngine();
    // Mobile GPUs are fill-rate bound on the raymarch, so cut DPR and steps
    // hard there — smoothness matters more than crispness on the backdrop.
    const ok = engine.mount(canvas, {
      octaves: coarse ? 3 : 5,
      marchSteps: coarse ? 20 : 48,
      maxDpr: coarse ? 0.8 : 1.5,
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
      // The proof section is intentionally 320svh and sticky. Its portal form
      // lands once the horizontal showcase is established, rather than at the
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
      engine.renderOnce(0.3);
      const onResize = () => {
        engine.resize();
        syncSectionAnchors();
        engine.renderOnce(0.3);
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

    // Touch drag to reposition the sculpture. A gesture that starts mostly
    // horizontal locks into "drag the sphere" (2D from then on); a mostly
    // vertical start stays a normal page scroll — no hijack.
    let tracking = false;
    let decided = false;
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      tracking = true;
      decided = false;
      dragging = false;
      const t = e.touches[0];
      sx = lx = t.clientX;
      sy = ly = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!decided) {
        const adx = Math.abs(t.clientX - sx);
        const ady = Math.abs(t.clientY - sy);
        if (adx > 8 || ady > 8) {
          decided = true;
          dragging = adx > ady * 1.2;
        }
      }
      if (decided && dragging) {
        e.preventDefault();
        const min = Math.min(window.innerWidth, window.innerHeight);
        engine.dragBy((t.clientX - lx) / min, -(t.clientY - ly) / min);
      }
      lx = t.clientX;
      ly = t.clientY;
    };
    const onTouchEnd = () => {
      tracking = false;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      engine.dispose();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {failed ? (
        <div className="absolute inset-0 [background:radial-gradient(90%_70%_at_30%_20%,rgba(46,107,255,0.18)_0%,transparent_60%),radial-gradient(80%_60%_at_75%_80%,rgba(46,107,255,0.10)_0%,transparent_55%)]" />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      )}

      {/* Legibility grade: nav scrim + vignette + bottom fade — kept light so
          the field itself stays visible */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/35 via-transparent to-bg/45" />
      <div className="absolute inset-0 [background:radial-gradient(120%_80%_at_50%_40%,transparent_55%,rgba(11,11,11,0.4)_100%)]" />
    </div>
  );
}

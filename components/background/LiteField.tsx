"use client";

import { useEffect, useRef, useState } from "react";
import { LiteEngine, selectLiteCount } from "@/lib/latent/lite";
import { measureSectionRanges, scrollProgress } from "@/lib/latent/sections";

/**
 * 2D particle field — what a machine that cannot run the WebGL simulation gets
 * instead of a static gradient.
 *
 * Same seven formations and the same scroll timing as the real field, at about
 * a thousandth of the particle count and with none of the shader work. It is
 * mounted only after the WebGL field has already declined to run, so the cost
 * of this being wrong is bounded: if even 2D cannot hold a rate, `onGiveUp`
 * hands over to the CSS gradient that used to be the only fallback.
 */
export default function LiteField({ onDead }: { onDead?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dead, setDead] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
  // Held in a ref, not a dependency: the parent re-renders while the debug
  // overlay ticks, and a fresh callback identity would tear down and rebuild
  // the whole field twice a second.
  const onDeadRef = useRef(onDead);
  onDeadRef.current = onDead;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dead) return;

    const nav = navigator as Navigator & { deviceMemory?: number };

    const engine = new LiteEngine();
    const die = () => {
      setDead(true);
      onDeadRef.current?.();
    };
    const ok = engine.mount(canvas, {
      count: selectLiteCount({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
      }),
      // 2D compositing is fill-rate bound and a retina buffer is four times the
      // pixels for no visible gain on a field this soft.
      maxDpr: 1,
      onGiveUp: die,
    });
    if (!ok) {
      die();
      return;
    }

    const syncRanges = () => {
      const ranges = measureSectionRanges();
      if (ranges) engine.setSectionRanges(ranges);
    };
    syncRanges();
    engine.setProgress(scrollProgress());

    // Same opt-in readout as the WebGL field, so a machine on the far end of a
    // call can be diagnosed without owning it.
    let diagTimer = 0;
    const mode = new URLSearchParams(window.location.search).get("latent");
    if (mode === "debug" || mode === "lite-debug") {
      const tick = () => {
        const d = engine.getDiagnostics();
        setDiag(
          [
            `LITE (2D fallback)`,
            `${d.particles} sprites · ${d.bufferW}x${d.bufferH}`,
            `cap ${d.fpsCap} · ${d.fps} fps`,
          ].join("\n"),
        );
      };
      tick();
      diagTimer = window.setInterval(tick, 500);
    }

    const onScroll = () => engine.setProgress(scrollProgress());
    const onResize = () => {
      engine.resize();
      syncRanges();
    };
    const onPointerMove = (e: PointerEvent) =>
      engine.setPointer(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    const onVisibility = () => (document.hidden ? engine.pause() : engine.resume());

    engine.start();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(diagTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
    };
  }, [dead]);

  return (
    <>
      {dead ? (
        <div className="latent-fallback absolute inset-0" aria-hidden />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      )}
      {diag ? (
        <pre className="pointer-events-none absolute left-3 top-3 z-50 whitespace-pre-wrap rounded-md bg-black/75 p-3 font-mono text-[10px] leading-relaxed text-amber-300">
          {diag}
        </pre>
      ) : null}
    </>
  );
}

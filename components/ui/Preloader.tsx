"use client";

import { useEffect, useState } from "react";
import { releaseIntro } from "@/lib/intro";

/**
 * Clean brand preloader. A counter + hairline bar fill while the page
 * settles, the wordmark holds center, then the panel splits and lifts away.
 * Dismisses on window `load` but never before a short minimum so it reads as
 * intentional, not a flash.
 */
export default function Preloader() {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const MIN = reduce ? 350 : 1000;
    let loaded = document.readyState === "complete";
    const onLoad = () => (loaded = true);
    if (!loaded) window.addEventListener("load", onLoad, { once: true });

    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      // Ease toward 90% on a timer; the last 10% waits for real load.
      const timed = Math.min(90, (elapsed / MIN) * 90);
      const target = loaded && elapsed >= MIN ? 100 : timed;
      setProgress((p) => p + (target - p) * 0.12);
      if (target >= 100 && elapsed >= MIN) {
        setProgress(100);
        setLeaving(true);
        // Hand the page over as the panels START parting, not once they are
        // gone: the hero reveal is meant to be caught in the opening, and
        // waiting for the full 900ms split would leave a dead beat instead.
        releaseIntro();
        setTimeout(() => setGone(true), reduce ? 300 : 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = gone ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [gone]);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* Split panels that part vertically on exit */}
      <div
        className={`absolute inset-x-0 top-0 h-1/2 bg-bg transition-transform duration-[900ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${
          leaving ? "-translate-y-full" : "translate-y-0"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-bg transition-transform duration-[900ms] ease-[cubic-bezier(0.76,0,0.24,1)] ${
          leaving ? "translate-y-full" : "translate-y-0"
        }`}
      />

      <div
        className={`relative flex flex-col items-center transition-all duration-500 ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Set in the display face: the panels part onto a field that is still
            resolving, and it spells this same wordmark again at the finale. */}
        <div className="display text-5xl md:text-6xl">
          TOZA <em>AI</em>
        </div>
        <div className="mt-6 h-px w-40 overflow-hidden bg-line md:w-52">
          <div
            className="h-full origin-left bg-accent"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <div className="mt-3 text-xs tabular-nums tracking-[0.3em] text-muted">
          {Math.round(progress).toString().padStart(3, "0")}
        </div>
      </div>
    </div>
  );
}

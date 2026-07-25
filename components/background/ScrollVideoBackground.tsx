"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-driven cinematic background — the "Scroll = montaža" concept.
 *
 * Two AI scenes are chained into one virtual film timeline. Page scroll scrubs
 * that timeline instead of playing it. Rather than a flat linear map, scroll is
 * mapped through control points that create HOLDS (film parks while a section is
 * read) and TRANSITIONS (film advances quickly as you move between sections).
 *
 *   Scene A: film time 0 .. SCENE_A_DUR
 *   Scene B: film time SCENE_A_DUR .. TOTAL      (offset into its own clip)
 */

const SCENE_A_DUR = 8; // scene1.web.mp4
const SCENE_B_DUR = 6; // scene2.web.mp4
const TOTAL = SCENE_A_DUR + SCENE_B_DUR;
const FADE = 0.7; // seconds of crossfade around the seam
const LERP = 0.18; // ease toward target (Lenis already smooths the input)

/**
 * Control points: [scrollProgress 0..1, filmTime seconds].
 * Gentle slope = hold (reading). Steep slope = transition (film moves).
 */
const CURVE: [number, number][] = [
  [0.0, 0.0], // hero — top
  [0.14, 0.8], // hero hold (slight drift)
  [0.27, 4.2], // → transition into stats
  [0.44, 4.9], // stats hold
  [0.57, 8.4], // → cross the seam into scene B
  [0.74, 9.4], // proof hold
  [0.87, 13.6], // → transition into booking
  [1.0, 14.0], // end hold
];

function mapScrollToTime(p: number): number {
  if (p <= CURVE[0][0]) return CURVE[0][1];
  if (p >= CURVE[CURVE.length - 1][0]) return CURVE[CURVE.length - 1][1];
  for (let i = 0; i < CURVE.length - 1; i++) {
    const [p0, t0] = CURVE[i];
    const [p1, t1] = CURVE[i + 1];
    if (p >= p0 && p <= p1) {
      const k = (p - p0) / (p1 - p0);
      return t0 + (t1 - t0) * k;
    }
  }
  return CURVE[CURVE.length - 1][1];
}

export default function ScrollVideoBackground() {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    const wrap = wrapRef.current;
    if (!a || !b || !wrap) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return; // poster frames stay; no scrubbing

    let displayed = 0; // eased film time (s)
    let running = true;

    const scrollProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const safeSeek = (v: HTMLVideoElement, t: number) => {
      if (v.readyState >= 1 && Number.isFinite(t)) {
        const d = v.duration || t;
        v.currentTime = Math.min(Math.max(t, 0), Math.max(d - 0.05, 0));
      }
    };

    const tick = () => {
      if (!running) return;
      const p = scrollProgress();
      const target = mapScrollToTime(p);
      displayed += (target - displayed) * LERP;

      safeSeek(a, Math.min(displayed, SCENE_A_DUR));
      safeSeek(b, Math.min(Math.max(displayed - SCENE_A_DUR, 0), SCENE_B_DUR));

      // Crossfade scene B in across the seam
      const seam = SCENE_A_DUR;
      let bOpacity = 0;
      if (displayed >= seam - FADE) {
        bOpacity = Math.min(1, (displayed - (seam - FADE)) / (FADE * 2));
      }
      b.style.opacity = String(bOpacity);
      a.style.opacity = String(1 - bOpacity * 0.9);

      // Slow cinematic breathing zoom so holds never feel frozen
      const scale = 1.04 + Math.sin(p * Math.PI) * 0.05;
      wrap.style.transform = `scale(${scale.toFixed(4)})`;

      rafRef.current = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) rafRef.current = requestAnimationFrame(tick);
    };

    a.load();
    b.load();
    rafRef.current = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div ref={wrapRef} className="absolute inset-0 will-change-transform">
        <video
          ref={aRef}
          className="absolute inset-0 h-full w-full object-cover"
          src="/media/scene1.web.mp4"
          poster="/media/hero-poster.jpg"
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
        <video
          ref={bRef}
          className="absolute inset-0 h-full w-full object-cover opacity-0"
          src="/media/scene2.web.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
      </div>

      {/* Legibility grade: top nav scrim + vignette + bottom fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/25 to-bg/85" />
      <div className="absolute inset-0 [background:radial-gradient(120%_80%_at_50%_40%,transparent_40%,rgba(11,11,11,0.7)_100%)]" />
    </div>
  );
}

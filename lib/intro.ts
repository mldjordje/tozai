"use client";

import { useEffect, useState } from "react";

/**
 * Gate for anything that animates on MOUNT rather than on scroll.
 *
 * The preloader owns an opaque panel over the first ~2s of the page. A reveal
 * started at mount therefore plays out entirely behind that panel and is
 * already finished by the time the panel parts — the hero headline looked like
 * it had no animation at all. Components that must be *seen* arriving wait on
 * this gate instead of on mount.
 */
let released = false;
const waiting = new Set<() => void>();

/** Called by the preloader the moment its panels start parting. */
export function releaseIntro() {
  if (released) return;
  released = true;
  for (const fn of waiting) fn();
  waiting.clear();
}

/**
 * `false` until the preloader hands the page over. Falls back to a timer so a
 * route that never mounts a preloader still plays its reveal rather than
 * sitting on the hidden variant forever.
 */
export function useIntroReleased(fallbackMs = 2600) {
  const [ready, setReady] = useState(released);

  useEffect(() => {
    if (released) {
      setReady(true);
      return;
    }
    const open = () => setReady(true);
    waiting.add(open);
    const timer = window.setTimeout(releaseIntro, fallbackMs);
    return () => {
      waiting.delete(open);
      window.clearTimeout(timer);
    };
  }, [fallbackMs]);

  return ready;
}

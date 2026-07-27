const REFERENCE_PARTICLES = 512 * 512;
export const TRANSITION_ACCENT_SECONDS = 0.22;

/**
 * Preserve presence on lower particle profiles without turning each remaining
 * mobile particle into a lamp.
 */
export function particleLightGain(count: number): number {
  return Math.sqrt(REFERENCE_PARTICLES / Math.max(1, count));
}

/** Keep overlapping particles from flashing while two formations cross. */
export function morphLightMultiplier(shape: number): number {
  const fraction = shape - Math.floor(shape);
  const morph = 4 * fraction * (1 - fraction);
  return 1 - morph * 0.22;
}

/** -1 means inactive; otherwise the shader receives a normalized sweep phase. */
export function transitionAccentPhase(ageSeconds: number): number {
  if (ageSeconds < 0 || ageSeconds >= TRANSITION_ACCENT_SECONDS) return -1;
  return ageSeconds / TRANSITION_ACCENT_SECONDS;
}

/** How long the idle sweep takes to cross the form, and how often it runs. */
export const SHIMMER_SWEEP_SECONDS = 2.8;
export const SHIMMER_PERIOD_SECONDS = 13;
/** The field boots out of chaos; the first sweep waits for it to settle. */
export const SHIMMER_FIRST_AT_SECONDS = 6;

/**
 * Idle light sweep — a slow plane of light crossing the settled form.
 *
 * Deliberately rare and deliberately slow. The whole rig is built to avoid
 * brightness that is uncorrelated with the shape, so this is the one exception
 * and it earns it by being a travelling WAVEFRONT: it lights the near side
 * before the far side and wraps the silhouette, which is something a screen
 * -space overlay cannot do. Run it often and it becomes the sparkle the
 * lighting was written to remove.
 *
 * -1 means no sweep is running; otherwise 0..1 across one crossing.
 */
export function shimmerPhase(timeSeconds: number): number {
  if (!Number.isFinite(timeSeconds) || timeSeconds < SHIMMER_FIRST_AT_SECONDS) {
    return -1;
  }
  const cycle = (timeSeconds - SHIMMER_FIRST_AT_SECONDS) % SHIMMER_PERIOD_SECONDS;
  return cycle < SHIMMER_SWEEP_SECONDS ? cycle / SHIMMER_SWEEP_SECONDS : -1;
}

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

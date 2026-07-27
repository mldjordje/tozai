import assert from "node:assert/strict";
import test from "node:test";

import {
  SHIMMER_FIRST_AT_SECONDS,
  SHIMMER_PERIOD_SECONDS,
  SHIMMER_SWEEP_SECONDS,
  TRANSITION_ACCENT_SECONDS,
  morphLightMultiplier,
  particleLightGain,
  shimmerPhase,
  transitionAccentPhase,
} from "../lib/latent/lighting.ts";

test("uses sublinear light compensation for reduced particle profiles", () => {
  assert.equal(particleLightGain(512 * 512), 1);
  assert.equal(particleLightGain(256 * 256), 2);
  assert.ok(Math.abs(particleLightGain(192 * 192) - 8 / 3) < 1e-12);
});

test("dims the midpoint of a morph without changing settled shots", () => {
  assert.equal(morphLightMultiplier(2), 1);
  assert.equal(morphLightMultiplier(2.5), 0.78);
  assert.equal(morphLightMultiplier(3), 1);
});

test("transition accent is normalized and ends after 220ms", () => {
  assert.equal(transitionAccentPhase(-0.01), -1);
  assert.equal(transitionAccentPhase(0), 0);
  assert.equal(transitionAccentPhase(TRANSITION_ACCENT_SECONDS / 2), 0.5);
  assert.equal(transitionAccentPhase(TRANSITION_ACCENT_SECONDS), -1);
});

test("idle shimmer holds off while the field is still booting", () => {
  assert.equal(shimmerPhase(0), -1);
  assert.equal(shimmerPhase(SHIMMER_FIRST_AT_SECONDS - 0.01), -1);
  assert.equal(shimmerPhase(SHIMMER_FIRST_AT_SECONDS), 0);
});

test("idle shimmer sweeps once per period and is idle in between", () => {
  const mid = SHIMMER_FIRST_AT_SECONDS + SHIMMER_SWEEP_SECONDS / 2;
  assert.ok(Math.abs(shimmerPhase(mid) - 0.5) < 1e-9);
  // The sweep is over well before the next one is due — the gap is the point.
  assert.equal(shimmerPhase(SHIMMER_FIRST_AT_SECONDS + SHIMMER_SWEEP_SECONDS), -1);
  assert.equal(shimmerPhase(SHIMMER_FIRST_AT_SECONDS + SHIMMER_PERIOD_SECONDS - 0.01), -1);
  assert.equal(shimmerPhase(SHIMMER_FIRST_AT_SECONDS + SHIMMER_PERIOD_SECONDS), 0);
  assert.ok(Math.abs(shimmerPhase(mid + SHIMMER_PERIOD_SECONDS * 4) - 0.5) < 1e-9);
});

test("idle shimmer never returns a phase outside the sweep", () => {
  for (let t = 0; t < SHIMMER_PERIOD_SECONDS * 3; t += 0.05) {
    const p = shimmerPhase(t);
    assert.ok(p === -1 || (p >= 0 && p < 1), `phase ${p} at t=${t}`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSITION_ACCENT_SECONDS,
  morphLightMultiplier,
  particleLightGain,
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

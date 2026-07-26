import assert from "node:assert/strict";
import test from "node:test";

import {
  getSafeCanvasSize,
  selectLatentProfile,
} from "../lib/latent/quality.ts";

test("uses the efficient profile on constrained desktop hardware", () => {
  assert.equal(
    selectLatentProfile({
      viewportWidth: 1920,
      viewportHeight: 1080,
      deviceMemory: 4,
      hardwareConcurrency: 4,
    }).name,
    "efficient",
  );
});

test("does not assume unknown desktop hardware can run the maximum profile", () => {
  assert.equal(
    selectLatentProfile({
      viewportWidth: 1920,
      viewportHeight: 1080,
    }).name,
    "balanced",
  );
});

test("keeps the authored high profile on capable 1080p hardware", () => {
  assert.equal(
    selectLatentProfile({
      viewportWidth: 1920,
      viewportHeight: 1080,
      deviceMemory: 8,
      hardwareConcurrency: 8,
    }).name,
    "high",
  );
});

test("caps a high-DPR 4K canvas to the GPU texture and pixel budgets", () => {
  const size = getSafeCanvasSize({
    cssWidth: 3840,
    cssHeight: 2160,
    devicePixelRatio: 2,
    maxDpr: 1.5,
    maxTextureSize: 4096,
    maxRenderPixels: 5_000_000,
  });

  assert.ok(size.width <= 4096);
  assert.ok(size.height <= 4096);
  assert.ok(size.width * size.height <= 5_000_000);
  assert.ok(size.dpr < 1.5);
});

test("preserves full profile DPR when it is within every budget", () => {
  assert.deepEqual(
    getSafeCanvasSize({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 2,
      maxDpr: 1.5,
      maxTextureSize: 8192,
      maxRenderPixels: 5_000_000,
    }),
    { width: 2880, height: 1620, dpr: 1.5 },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRendererClass,
  classifyRenderer,
  getSafeCanvasSize,
  PerfGovernor,
  PERF_STEPS,
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

test("classifies the GPU strings that decide whether the field can run", () => {
  assert.equal(
    classifyRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))"),
    "software",
  );
  assert.equal(classifyRenderer("Mesa/X.org llvmpipe (LLVM 15.0.6, 256 bits)"), "software");
  assert.equal(
    classifyRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0)"),
    "capable",
  );
  assert.equal(classifyRenderer("Apple M2 Pro"), "capable");
  assert.equal(
    classifyRenderer("ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0)"),
    "weak",
  );
  assert.equal(classifyRenderer("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)"), "modest");
  assert.equal(classifyRenderer(""), "unknown");
});

test("a fast CPU with integrated graphics does not keep the high profile", () => {
  // The exact machine the field used to die on: eight cores, 8GB, Intel UHD.
  const opening = selectLatentProfile({
    viewportWidth: 1920,
    viewportHeight: 1080,
    deviceMemory: 8,
    hardwareConcurrency: 8,
  });
  assert.equal(opening.name, "high");
  assert.equal(applyRendererClass(opening, "weak")?.name, "minimal");
});

test("a software rasteriser is refused outright", () => {
  assert.equal(applyRendererClass(selectLatentProfile({ viewportWidth: 1440, viewportHeight: 900 }), "software"), null);
});

test("a capable GPU keeps whatever the pre-flight signals asked for", () => {
  const opening = selectLatentProfile({ viewportWidth: 1440, viewportHeight: 900 });
  assert.equal(applyRendererClass(opening, "capable"), opening);
});

test("renderer class never upgrades a profile that is already lower", () => {
  const efficient = selectLatentProfile({
    viewportWidth: 1920,
    viewportHeight: 1080,
    deviceMemory: 4,
    hardwareConcurrency: 4,
  });
  assert.equal(efficient.name, "efficient");
  // "modest" caps AT efficient — it must not lift a minimal-bound device back up
  // and must not raise this one either.
  assert.equal(applyRendererClass(efficient, "modest")?.name, "efficient");
});

test("the governor walks down the ladder on sustained slow frames", () => {
  const g = new PerfGovernor(0);
  const feed = (ms: number, n: number) => {
    let last: string = "hold";
    for (let i = 0; i < n; i++) last = g.sample(ms);
    return last;
  };
  // Warmup frames are ignored, then a window of 48 decides.
  feed(90, 30);
  assert.equal(feed(90, 48), "changed");
  assert.equal(g.level, 1);
});

test("the governor climbs back up when the frames are comfortable", () => {
  const g = new PerfGovernor(2);
  for (let i = 0; i < 30; i++) g.sample(8);
  let level = g.level;
  for (let i = 0; i < 48 * 6; i++) {
    if (g.sample(8) === "changed") level = g.level;
  }
  assert.ok(level < 2, `expected the governor to climb, stayed at ${level}`);
});

test("the governor gives up only after the cheapest step also fails twice", () => {
  const last = PERF_STEPS.length - 1;
  const g = new PerfGovernor(last);
  for (let i = 0; i < 30; i++) g.sample(200);
  const first: string[] = [];
  for (let i = 0; i < 48; i++) first.push(g.sample(200));
  assert.ok(!first.includes("abort"));
  let verdict = "hold";
  for (let i = 0; i < 48; i++) verdict = g.sample(200);
  assert.equal(verdict, "abort");
});

test("the governor ignores tab stalls instead of demoting for them", () => {
  const g = new PerfGovernor(0);
  for (let i = 0; i < 30; i++) g.sample(16);
  for (let i = 0; i < 200; i++) assert.equal(g.sample(5000), "hold");
  assert.equal(g.level, 0);
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

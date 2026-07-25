# Cinematic Section Sculpture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic section morphs with medium-sized, story-specific cinematic chrome forms while preserving the storm and lightning field.

**Architecture:** Keep the existing raw WebGL2 fullscreen raymarcher and six-keyframe scroll choreography. Implement each narrative form as a bounded SDF in `lib/latent/shader.ts`, blend adjacent forms through the existing `uShape` uniform, and tune only the per-section choreography values in `lib/latent/engine.ts`.

**Tech Stack:** Next.js 15, TypeScript, WebGL2, GLSL ES 3.00, Playwright/Chromium for browser verification.

---

## File Map

- `lib/latent/shader.ts`: semantic SDF geometry, shape-aware motion, raymarch material, lighting, and restrained bloom contribution.
- `lib/latent/engine.ts`: scroll progress keyframes, normalized medium scale, shape phase, and portrait positioning.
- `docs/superpowers/specs/2026-07-25-cinematic-section-sculpture-design.md`: approved design intent; no implementation changes.

### Task 1: Build Semantic Section Forms

**Files:**
- Modify: `lib/latent/shader.ts`

- [ ] **Step 1: Replace generic primitive helpers with semantic bounded SDFs**

Implement six similarly bounded forms:

```glsl
float sdHeroCore(vec3 p, float t);
float sdDataNodes(vec3 p, float t);
float sdSignalPortal(vec3 p, float t);
float sdModules(vec3 p, float t);
float sdKnowledge(vec3 p, float t);
float sdResolved(vec3 p, float t);
```

Use smooth unions for the organic hero, connected data nodes, modular package
seams, and neural branches. Use a warped torus plus orbiting signal nodes for
results. Use a sphere with a subtle equatorial fold for booking. Keep every
silhouette inside an approximate radius of `0.72` so morphs do not appear to
resize.

- [ ] **Step 2: Route the six forms through the existing shape blend**

Keep the current continuous interpolation contract:

```glsl
float shapeSDF(vec3 q, float t, int k) {
  if (k <= 0) return sdHeroCore(q, t);
  if (k == 1) return sdDataNodes(q, t);
  if (k == 2) return sdSignalPortal(q, t);
  if (k == 3) return sdModules(q, t);
  if (k == 4) return sdKnowledge(q, t);
  return sdResolved(q, t);
}
```

Use `smoothstep(0.08, 0.92, fract(si))` for the blend so each form holds briefly
around its section center and transitions through a controlled middle range.

- [ ] **Step 3: Verify the TypeScript production compiler still accepts the shader source**

Run:

```powershell
npm run build
```

Expected: exit code `0`, with no TypeScript error and no malformed template
literal error in `lib/latent/shader.ts`.

### Task 2: Upgrade Material and Motion

**Files:**
- Modify: `lib/latent/shader.ts`

- [ ] **Step 1: Add slow weighted shape-aware motion**

Keep the global two-axis tumble but lower its apparent speed. Add only subtle
shape-local motion inside each SDF, driven by `t`, and retain scroll stretch:

```glsl
q.y /= 1.0 + uVelocity * 0.38;
float ca = cos(t * 0.24), sa = sin(t * 0.24);
q.xy = mat2(ca, -sa, sa, ca) * q.xy;
float cb = cos(t * 0.16), sb = sin(t * 0.16);
q.yz = mat2(cb, -sb, sb, cb) * q.yz;
```

Keep pointer grab, click pulse, and drag behavior unchanged.

- [ ] **Step 2: Layer the chrome response without overwhelming the storm**

In the hit branch, derive controlled reflection depth from Fresnel, a
micro-normal modulation sampled from `fbm`, a narrow white key highlight, a
cool storm rim, a late-page warm rim, and restrained thin-film color. Cap the
material contribution so lightning remains visible around the object:

```glsl
float micro = fbm(n.xy * 3.5 + n.z + st * 0.08) - 0.5;
float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.35);
float key = pow(max(dot(n, normalize(vec3(0.58, 0.72, -0.46))), 0.0), 72.0);
float coolRim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
float warmRim = pow(max(dot(n, normalize(vec3(-0.55, -0.2, -0.8))), 0.0), 28.0);
```

Keep iridescence below `0.14`, near-miss halo below `0.4`, and do not add a new
full-screen glow layer.

- [ ] **Step 3: Run static verification**

Run:

```powershell
npm run build
git diff --check
```

Expected: both commands exit `0`.

### Task 3: Tune Medium-Scale Choreography

**Files:**
- Modify: `lib/latent/engine.ts`

- [ ] **Step 1: Retune section keyframes without increasing the object**

Keep desktop scale between `0.23` and `0.31`, using small normalization changes
only where silhouettes differ:

```ts
const BLOB_KEYS: [number, number, number, number, number, number][] = [
  [0.0, 0.32, 0.04, 0.29, 0.0, 0.0],
  [0.16, -0.34, 0.02, 0.25, 1.15, 1.0],
  [0.36, 0.33, 0.06, 0.27, 2.25, 2.0],
  [0.56, -0.31, 0.0, 0.25, 3.15, 3.0],
  [0.76, 0.31, -0.02, 0.24, 4.05, 4.0],
  [1.0, 0.0, 0.1, 0.31, 4.85, 5.0],
];
```

The non-integer morph phases intentionally delay transitions so the semantic
shape is legible around each section.

- [ ] **Step 2: Keep portrait scale medium and preserve text clearance**

Retain the current portrait scale multiplier at or below `0.85`, keep the
sculpture above the copy, and do not widen the horizontal clamp.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: exit code `0`.

### Task 4: Browser and Interaction Verification

**Files:**
- Verify: `lib/latent/shader.ts`
- Verify: `lib/latent/engine.ts`

- [ ] **Step 1: Start the production or development server**

Run:

```powershell
npm run dev
```

Expected: Next.js reports a local URL and remains running.

- [ ] **Step 2: Inspect all six section states on desktop**

At a viewport near `1440x900`, capture the hero, numbers, results, packages,
education, and booking states. Confirm the object remains medium-sized, each
shape is recognizable, transitions are continuous, and clouds/lightning remain
visible around it.

- [ ] **Step 3: Inspect portrait behavior**

At a viewport near `390x844`, scroll through the same states and confirm the
object does not obscure primary headings or controls and remains draggable.

- [ ] **Step 4: Verify interaction and motion preferences**

Move the pointer near the sculpture, click it, scroll slowly and quickly, and
emulate `prefers-reduced-motion: reduce`. Confirm grab, pulse, velocity response,
and the reduced-motion static render all remain functional.

- [ ] **Step 5: Final repository verification and commit**

Run:

```powershell
npm run build
git diff --check
git status --short
```

Expected: build and diff checks exit `0`; status lists only the intended shader,
engine, and plan changes before commit.


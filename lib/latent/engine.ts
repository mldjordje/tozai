// Latent-field particle engine — raw WebGL2 GPGPU, no dependencies.
//
//   const engine = new LatentEngine();
//   engine.mount(canvas, { texDim, maxDpr })  -> false if unsupported
//   engine.setProgress(p)          // page scroll 0..1 (eased internally)
//   engine.setSectionRanges([..])  // one [holdStart, holdEnd] per formation
//   engine.setPointer(x, y)        // normalized 0..1, y up (eased internally)
//   engine.setCopyRect(...)        // screen box the field should keep clear of
//   engine.pulse()                 // click shockwave
//   engine.renderOnce(p)           // single settled frame (reduced motion)
//   engine.resize(); engine.pause(); engine.resume(); engine.dispose();
//
// Requires WebGL2 + EXT_color_buffer_float (the simulation lives in float
// textures). mount() returns false without it and the caller falls back to a
// static gradient.

import {
  fullscreenVertexShader,
  makeSimShader,
  pointVertexShader,
  pointFragmentShader,
  displayShader,
} from "./shader";

export interface LatentOptions {
  /** Particle texture edge — 512 = 262k particles (desktop), 256 = 65k (mobile). */
  texDim?: number;
  /** Device-pixel-ratio cap. */
  maxDpr?: number;
}

// Camera constants, mirrored from pointVertexShader. Used to convert pointer
// coordinates from the screen into field units at the z=0 plane.
const CAM_Z = 3.15;
const FOCAL = 1.45;
const PLANE = FOCAL / CAM_Z;

// Field choreography per formation: [centerX, centerY, scale, exposure].
// Center is an NDC offset — on desktop the field sits right of the copy.
// Exposure compensates for how tightly each formation packs its particles:
// the network spreads over the widest footprint so it needs the least.
type FieldKey = [number, number, number, number];

const FIELD_KEYS: FieldKey[] = [
  [0.36, 0.02, 1.0, 1.0], // hero — latent core
  [0.3, 0.06, 0.88, 1.0], // brojevi — lattice (a wide flat plane)
  [0.0, 0.1, 1.12, 0.86], // rezultati — stream spans the viewport
  [0.28, 0.04, 1.0, 0.92], // paketi — three clusters
  [0.3, 0.06, 1.04, 0.5], // edukacija — network (widest footprint)
  [0.0, 0.06, 0.92, 1.05], // booking — singularity, centered
  [0.0, 0.04, 1.1, 0.62], // finale — the field spells TOZAI
];

// Scroll window each formation OWNS, as [holdStart, holdEnd] in page progress.
// Inside its window the shape is pinned and the field is allowed to settle;
// between two windows it morphs. A single anchor point per section can only
// ever cross-fade, which is why the forms never used to resolve.
type HoldRange = [number, number];

function smootherstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[latent] shader compile failed:", gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class LatentEngine {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private running = false;
  private maxDpr = 1.5;

  private dim = 512;
  private count = 512 * 512;

  private simProg: WebGLProgram | null = null;
  private pointProg: WebGLProgram | null = null;
  private showProg: WebGLProgram | null = null;

  private posA: WebGLTexture | null = null;
  private posB: WebGLTexture | null = null;
  private velA: WebGLTexture | null = null;
  private velB: WebGLTexture | null = null;
  private wordTex: WebGLTexture | null = null;
  private simFbo: WebGLFramebuffer | null = null;
  private sceneFbo: WebGLFramebuffer | null = null;
  private sceneTex: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // Eased state — events set targets, the loop chases them so nothing jumps.
  private progressTarget = 0;
  private progress = 0;
  private prevProgress = 0;
  private pointerTarget: [number, number] = [0.5, 0.5];
  private pointer: [number, number] = [0.5, 0.5];
  private energy = 0;
  // Fallback spacing until the DOM is measured: evenly spaced, zero-width
  // holds, i.e. the old cross-fade behaviour.
  private ranges: HoldRange[] = [
    [0, 0],
    [0.14, 0.14],
    [0.32, 0.32],
    [0.5, 0.5],
    [0.68, 0.68],
    [0.86, 0.86],
    [1, 1],
  ];

  // Copy column to keep clear, in normalized screen coords (0..1, y up).
  private copyRect: [number, number, number, number] = [0, 0, 0, 0];
  private copyAmt = 0;

  // First-load ramp: the field opens as chaos and resolves into the hero core
  // as the preloader lifts, instead of appearing already finished.
  private bootStart = 0;
  private boot = 0;

  private shape = 0;
  private prevShape = 0;
  private velocity = 0;
  private turb = 0;
  private settle = 0;
  private pulseV = 0;
  private animTime = 0;
  private lastNow = 0;

  // Orbit. The formations are static and the camera turns around them, so
  // this is the one piece of state the user can actually steer.
  private yaw = 0;
  private pitch = 0;
  private yawVel = 0;
  private pitchVel = 0;
  private faceOn = 0;
  private rot = new Float32Array(9);

  mount(canvas: HTMLCanvasElement, options: LatentOptions = {}): boolean {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    // The whole simulation lives in float render targets. No extension, no
    // engine — the caller shows its CSS fallback instead.
    if (!gl.getExtension("EXT_color_buffer_float")) return false;

    this.dim = options.texDim ?? 512;
    this.count = this.dim * this.dim;
    this.maxDpr = options.maxDpr ?? 1.5;

    const link = (vsSrc: string, fsSrc: string): WebGLProgram | null => {
      const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      const p = gl.createProgram();
      if (!p) return null;
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[latent] link failed:", gl.getProgramInfoLog(p));
        }
        gl.deleteProgram(p);
        return null;
      }
      return p;
    };

    this.simProg = link(fullscreenVertexShader, makeSimShader(this.count));
    this.pointProg = link(pointVertexShader, pointFragmentShader);
    this.showProg = link(fullscreenVertexShader, displayShader);
    if (!this.simProg || !this.pointProg || !this.showProg) return false;

    this.gl = gl;
    this.canvas = canvas;
    this.vao = gl.createVertexArray();
    this.simFbo = gl.createFramebuffer();
    this.sceneFbo = gl.createFramebuffer();

    // Seed: an isotropic cloud of noise. The field literally boots from chaos
    // and resolves into the hero formation on first paint.
    const seed = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = Math.cbrt(Math.random()) * 1.9;
      const s = Math.sqrt(1 - u * u);
      seed[i * 4] = s * Math.cos(t) * r;
      seed[i * 4 + 1] = s * Math.sin(t) * r;
      seed[i * 4 + 2] = u * r;
      seed[i * 4 + 3] = 1;
    }
    this.posA = this.dataTex(gl, this.dim, this.dim, seed);
    this.posB = this.dataTex(gl, this.dim, this.dim, null);
    this.velA = this.dataTex(gl, this.dim, this.dim, new Float32Array(this.count * 4));
    this.velB = this.dataTex(gl, this.dim, this.dim, null);
    if (!this.posA || !this.posB || !this.velA || !this.velB) return false;

    this.buildWordmark();
    // The display face almost never wins the race with mount, so rebuild once
    // it lands — otherwise the finale is set in the fallback serif.
    document.fonts?.ready.then(() => {
      if (this.gl) this.buildWordmark();
    });

    this.resize();
    this.lastNow = performance.now();
    this.bootStart = this.lastNow;
    return true;
  }

  /** Copy column to keep the field clear of, in normalized screen coords
   *  (0..1, y up). Strength 0 disables it. */
  setCopyRect(x0: number, y0: number, x1: number, y1: number, strength = 1) {
    this.copyRect = [x0, y0, x1, y1];
    this.copyAmt = strength;
  }

  /**
   * Rasterise the wordmark and turn its lit pixels into one target position
   * per particle. Drawing type to a 2D canvas and sampling it is far simpler
   * than describing letterforms as SDFs, and it means the finale is literally
   * set in the site's own display face.
   *
   * Safe to call again once webfonts finish loading — the first call may hit
   * the fallback serif, the second replaces it with Instrument Serif.
   */
  private buildWordmark() {
    const gl = this.gl;
    if (!gl) return;

    const W = 1024;
    const H = 256;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-instrument")
      .trim();
    ctx.font = `400 ${Math.round(H * 0.78)}px ${family || "Georgia"}, Georgia, serif`;
    ctx.fillText("TOZAI", W / 2, H * 0.54);

    // Collect the lit pixels once, then draw particles from that pool.
    const px = ctx.getImageData(0, 0, W, H).data;
    const lit: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (px[i * 4] > 110) lit.push(i);
    }
    if (lit.length === 0) return;

    // Field extents chosen to match the other formations' footprint, so the
    // morph into the wordmark does not jump in scale.
    const spanX = 5.0;
    const spanY = (spanX * H) / W;
    const data = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      const hit = lit[(Math.random() * lit.length) | 0];
      const x = hit % W;
      const y = (hit / W) | 0;
      data[i * 4] = ((x + Math.random()) / W - 0.5) * spanX;
      // Canvas y runs down, the field's runs up.
      data[i * 4 + 1] = -((y + Math.random()) / H - 0.5) * spanY;
      data[i * 4 + 2] = (Math.random() - 0.5) * 0.11; // a thin slab, not a plane
      data[i * 4 + 3] = 1;
    }

    if (this.wordTex) gl.deleteTexture(this.wordTex);
    this.wordTex = this.dataTex(gl, this.dim, this.dim, data);
  }

  /** RGBA32F texture, NEAREST — simulation state, never filtered. */
  private dataTex(
    gl: WebGL2RenderingContext,
    w: number,
    h: number,
    data: Float32Array | null,
  ): WebGLTexture | null {
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  start() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.lastNow = performance.now();
    this.loop();
  }

  setProgress(p: number) {
    this.progressTarget = Math.min(Math.max(p, 0), 1);
  }

  /** Bind each formation to the scroll window its section stays pinned for, so
   *  the shape story tracks the real layout when sticky sections, CMS content
   *  or a resize change the document height.
   *
   *  Ranges are clamped into ascending order: a formation whose section is not
   *  pinned collapses to a zero-width hold and simply cross-fades. */
  setSectionRanges(ranges: HoldRange[]) {
    if (ranges.length !== FIELD_KEYS.length) return;
    if (ranges.some((r) => !Number.isFinite(r[0]) || !Number.isFinite(r[1]))) return;
    let previous = 0;
    this.ranges = ranges.map(([rawStart, rawEnd]) => {
      const start = Math.min(1, Math.max(previous, rawStart));
      const end = Math.min(1, Math.max(start, rawEnd));
      previous = end;
      return [start, end] as HoldRange;
    });
  }

  setPointer(x: number, y: number) {
    const speed = Math.hypot(x - this.pointerTarget[0], y - this.pointerTarget[1]);
    this.energy = Math.min(1, this.energy + speed * 4);
    this.pointerTarget = [x, y];
  }

  /** Click/tap — an outward shockwave through the field. */
  pulse() {
    this.pulseV = 1;
    this.turb = Math.min(1.4, this.turb + 0.7);
  }

  /** Drag to orbit. Deltas are normalized to the smaller viewport dimension,
   *  y up. Feeds angular velocity rather than angle so releasing a fast drag
   *  keeps spinning and coasts to rest. */
  dragBy(dx: number, dy: number) {
    this.yawVel += dx * 6.5;
    this.pitchVel += dy * 5.0;
    this.energy = Math.min(1, this.energy + Math.hypot(dx, dy) * 3);
  }

  /** Rotation for the current orbit, as a column-major mat3. Pointer parallax
   *  is added here rather than accumulated, so it leans and returns. */
  private buildRot() {
    const lean = 1 - this.faceOn;
    const yaw = this.yaw + (this.pointer[0] - 0.5) * 0.22 * lean;
    const pitch = this.pitch + (this.pointer[1] - 0.5) * 0.14 * lean;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw), written out column by column.
    const r = this.rot;
    r[0] = cy;
    r[1] = sp * sy;
    r[2] = -cp * sy;
    r[3] = 0;
    r[4] = cp;
    r[5] = sp;
    r[6] = sy;
    r[7] = -sp * cy;
    r[8] = cp * cy;
    return r;
  }

  /** Draw one settled frame — used under prefers-reduced-motion. */
  renderOnce(progress = 0.3) {
    this.progress = this.progressTarget = clamp01(progress);
    this.prevProgress = this.progress;
    this.shape = this.prevShape = this.shapeAt(this.progress);
    this.settle = 1;
    this.boot = 1;
    if (this.shape > 5.15) {
      this.yaw = 0;
      this.pitch = 0;
      this.faceOn = 1;
    }
    this.animTime = 12;
    // Run the simulation forward so the particles have actually arrived at
    // their formation before the single frame is drawn.
    for (let i = 0; i < 220; i++) {
      this.animTime += 1 / 60;
      this.simulate(1 / 60);
    }
    this.draw();
  }

  resize() {
    const canvas = this.canvas;
    const gl = this.gl;
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === width && canvas.height === height && this.sceneTex) return;
    canvas.width = width;
    canvas.height = height;
    if (this.sceneTex) gl.deleteTexture(this.sceneTex);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sceneTex = t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.lastNow = performance.now();
    this.loop();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    const gl = this.gl;
    if (gl) {
      for (const p of [this.simProg, this.pointProg, this.showProg]) {
        if (p) gl.deleteProgram(p);
      }
      for (const t of [this.posA, this.posB, this.velA, this.velB, this.sceneTex, this.wordTex]) {
        if (t) gl.deleteTexture(t);
      }
      if (this.simFbo) gl.deleteFramebuffer(this.simFbo);
      if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
      if (this.vao) gl.deleteVertexArray(this.vao);
    }
    this.simProg = this.pointProg = this.showProg = null;
    this.posA = this.posB = this.velA = this.velB = this.sceneTex = this.wordTex = null;
    this.simFbo = this.sceneFbo = null;
    this.vao = null;
    this.gl = null;
    this.canvas = null;
  }

  /** Fractional formation index for a scroll position. Flat inside a hold
   *  window, easing between windows — the plateau is what lets the field
   *  actually arrive at a shape instead of forever crossing between two. */
  private shapeAt(p: number): number {
    const r = this.ranges;
    if (p <= r[0][1]) return 0;
    for (let i = 0; i < r.length - 1; i++) {
      const gapStart = r[i][1];
      const gapEnd = r[i + 1][0];
      if (p < gapEnd) {
        const span = gapEnd - gapStart;
        return span < 1e-5 ? i + 1 : i + smootherstep((p - gapStart) / span);
      }
      if (p <= r[i + 1][1]) return i + 1;
    }
    return r.length - 1;
  }

  /** Interpolate [centerX, centerY, scale, exposure] for a fractional shape
   *  index. Keyed off the shape rather than raw progress so the framing can
   *  never drift out of step with the formation it is framing. */
  private frameAt(shape: number): [number, number, number, number] {
    const last = FIELD_KEYS.length - 1;
    const i0 = Math.max(0, Math.min(last, Math.floor(shape)));
    const i1 = Math.min(last, i0 + 1);
    const u = smootherstep(shape - i0);
    const a = FIELD_KEYS[i0];
    const b = FIELD_KEYS[i1];
    return [
      a[0] + (b[0] - a[0]) * u,
      a[1] + (b[1] - a[1]) * u,
      a[2] + (b[2] - a[2]) * u,
      a[3] + (b[3] - a[3]) * u,
    ];
  }

  /** Advance the particle state by dt (MRT into the back position/velocity
   *  textures, then swap). */
  private simulate(dt: number) {
    const gl = this.gl;
    if (!gl || !this.simProg || !this.canvas) return;

    const [cx, cy, scale] = this.layout();
    // Pointer -> VIEW units on the z=0 plane, matching pointVertexShader. The
    // shader compares this against uRot*p, so no inverse is needed here; the
    // scale divide keeps the cursor's reach constant as the field resizes.
    const aspect = this.canvas.width / this.canvas.height;
    const ptrX = ((this.pointer[0] * 2 - 1 - cx) * aspect) / PLANE / scale;
    const ptrY = (this.pointer[1] * 2 - 1 - cy) / PLANE / scale;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.posB, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velB, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.dim, this.dim);
    gl.disable(gl.BLEND);

    gl.useProgram(this.simProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posA);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "uPos"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velA);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "uVel"), 1);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "uDim"), this.dim, this.dim);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uTime"), this.animTime);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uDt"), dt);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uShape"), this.shape);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uTurb"), this.turb);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uSettle"), this.settle);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uPulse"), this.pulseV);
    gl.uniform3f(gl.getUniformLocation(this.simProg, "uPtr"), ptrX, ptrY, this.energy);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.simProg, "uRot"), false, this.buildRot());
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uBoot"), this.boot);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.wordTex ?? this.posA);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "uWord"), 2);

    // Copy column -> the same view units the shader compares against uRot*p.
    const toViewX = (n: number) => ((n * 2 - 1 - cx) * aspect) / PLANE / scale;
    const toViewY = (n: number) => (n * 2 - 1 - cy) / PLANE / scale;
    gl.uniform4f(
      gl.getUniformLocation(this.simProg, "uCopy"),
      toViewX(this.copyRect[0]),
      toViewY(this.copyRect[1]),
      toViewX(this.copyRect[2]),
      toViewY(this.copyRect[3]),
    );
    gl.uniform1f(gl.getUniformLocation(this.simProg, "uCopyAmt"), this.copyAmt);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [this.posA, this.posB] = [this.posB, this.posA];
    [this.velA, this.velB] = [this.velB, this.velA];
  }

  /** Field placement for the current viewport.
   *
   *  The desktop keyframes assume the copy occupies a left column and the
   *  field has the right third to itself. That is only true above ~1024px:
   *  narrower viewports let the headline run the full width, so the field has
   *  to get out of the way rather than sit behind the type.
   *
   *  - portrait  : centred, dropped into the lower third
   *  - narrow    : pushed to the bottom-right corner, smaller
   *  - desktop   : the keyframes as authored
   */
  private layout(): [number, number, number, number] {
    const canvas = this.canvas!;
    const [cx, cy, scale, exposure] = this.frameAt(this.shape);
    if (canvas.width / canvas.height < 0.85) {
      return [cx * 0.2, cy * 0.25 - 0.42, scale * 0.72, exposure];
    }
    if (canvas.clientWidth < 1024) {
      return [cx * 0.5 + 0.32, cy * 0.3 - 0.4, scale * 0.62, exposure];
    }
    return [cx, cy, scale, exposure];
  }

  private draw() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.pointProg || !this.showProg) return;

    const [cx, cy, scale, exposure] = this.layout();

    // ---- accumulate points into the HDR buffer ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(this.pointProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posA);
    gl.uniform1i(gl.getUniformLocation(this.pointProg, "uPos"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velA);
    gl.uniform1i(gl.getUniformLocation(this.pointProg, "uVel"), 1);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, "uDim"), this.dim, this.dim);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uAspect"), canvas.width / canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uPxScale"), 1.35 * dpr);
    // Exposure was calibrated against 512x512 particles; keep the HDR buffer
    // receiving the same total light when mobile drops to 256x256.
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uGain"), (512 * 512) / this.count);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, "uCenter"), cx, cy);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uScale"), scale);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.pointProg, "uRot"), false, this.buildRot());
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);

    // ---- tonemap to screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.showProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(this.showProg, "uScene"), 0);
    gl.uniform2f(gl.getUniformLocation(this.showProg, "uTexSize"), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uTime"), this.animTime);
    // 1.75 is the calibrated base; the per-formation factor compensates for
    // how tightly each one packs its particles.
    //
    // Exposure also rides the boot ramp. Scattered across the whole viewport
    // the particles cover far more area than any settled formation, so at full
    // exposure the opening is a white blizzard that buries the hero copy. Dim
    // at first, brightening as the field gathers: the page resolves out of the
    // dark instead of flashing.
    gl.uniform1f(
      gl.getUniformLocation(this.showProg, "uExposure"),
      // Squared, with a very low floor: scattered over the viewport the cloud
      // covers roughly three times the area of any settled formation, so a
      // linear fade still opens brighter than the finished hero.
      1.75 * exposure * (0.06 + 0.94 * this.boot * this.boot),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastNow) / 1000, 0.05);
    this.lastNow = now;

    this.progress += (this.progressTarget - this.progress) * Math.min(1, dt * 4.2);
    this.pointer[0] += (this.pointerTarget[0] - this.pointer[0]) * Math.min(1, dt * 6);
    this.pointer[1] += (this.pointerTarget[1] - this.pointer[1]) * Math.min(1, dt * 6);
    this.energy *= Math.exp(-dt * 2.4);

    // Scroll velocity envelope: fast attack, slow release.
    // Boot ramp. Eased so the resolve decelerates into place rather than
    // arriving at constant speed.
    const bootAge = (now - this.bootStart) / 1600;
    this.boot = smootherstep(Math.min(1, Math.max(0, bootAge)));

    const rawVel = Math.min(
      1,
      (Math.abs(this.progress - this.prevProgress) / Math.max(dt, 1e-3)) * 9,
    );
    this.prevProgress = this.progress;
    this.velocity += (rawVel - this.velocity) * Math.min(1, dt * (rawVel > this.velocity ? 18 : 2.2));

    // Orbit: integrate the user's angular velocity, then let it coast. A slow
    // idle drift takes over once they stop steering, so the form keeps turning
    // enough to read as a solid without ever fighting the drag.
    this.yaw += this.yawVel * dt;
    this.pitch += this.pitchVel * dt;
    const decay = Math.exp(-dt * 2.4);
    this.yawVel *= decay;
    this.pitchVel *= decay;
    this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch));
    const steering = Math.min(1, Math.abs(this.yawVel) + Math.abs(this.pitchVel));

    // The wordmark only reads face-on, so as it arrives the orbit is eased
    // back to square and the idle drift is suspended. Yaw is returned to the
    // NEAREST full turn rather than to zero — after a few minutes of drift the
    // absolute angle is large, and unwinding it would spin the field.
    const faceOn = Math.min(1, Math.max(0, (this.shape - 5.15) / 0.85));
    this.yaw += dt * 0.06 * (1 - steering) * (1 - faceOn);
    if (faceOn > 0) {
      const k = Math.min(1, dt * 3 * faceOn);
      const square = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2;
      this.yaw += (square - this.yaw) * k;
      this.pitch += -this.pitch * k;
      this.yawVel *= 1 - k;
      this.pitchVel *= 1 - k;
    }
    this.faceOn = faceOn;

    this.shape = this.shapeAt(this.progress);
    const shapeRate = Math.abs(this.shape - this.prevShape) / Math.max(dt, 1e-3);
    this.prevShape = this.shape;

    // Turbulence is transient: scroll and formation changes inject it, then it
    // decays. The field spends most of its time settling, which is the point.
    this.turb = Math.max(
      this.turb * Math.pow(0.12, dt),
      Math.min(1.4, this.velocity * 0.8 + shapeRate * 0.5),
    );
    const busy = Math.min(1, this.turb + this.velocity);
    this.settle += (1 - busy - this.settle) * Math.min(1, dt * 1.6);
    this.pulseV *= Math.exp(-dt * 3.2);
    this.animTime += dt;

    this.simulate(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };
}

function clamp01(p: number): number {
  return Math.min(Math.max(p, 0), 1);
}

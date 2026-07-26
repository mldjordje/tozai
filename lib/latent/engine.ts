// Latent-field particle engine — raw WebGL2 GPGPU, no dependencies.
//
//   const engine = new LatentEngine();
//   engine.mount(canvas, { texDim, maxDpr })  -> false if unsupported
//   engine.setProgress(p)          // page scroll 0..1 (eased internally)
//   engine.setSectionAnchors([..]) // 6 progress values, one per formation
//   engine.setPointer(x, y)        // normalized 0..1, y up (eased internally)
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

// Field choreography: [progress, centerX, centerY, scale, exposure].
// Center is an NDC offset — on desktop the field sits right of the copy.
// Exposure compensates for how tightly each formation packs its particles:
// the network is sparse and thin so it needs more, the stream concentrates
// into a band so it needs less.
type FieldKey = [number, number, number, number, number];

const FIELD_KEYS: FieldKey[] = [
  [0.0, 0.36, 0.02, 1.0, 1.0], // hero — latent core
  [0.16, 0.3, 0.06, 1.06, 1.0], // brojevi — lattice
  [0.36, 0.0, 0.1, 1.12, 0.86], // rezultati — stream spans the viewport
  [0.56, 0.28, 0.04, 1.0, 0.92], // paketi — three clusters
  [0.76, 0.3, 0.06, 1.04, 0.5], // edukacija — network (widest footprint)
  [1.0, 0.0, 0.06, 0.92, 1.05], // booking — singularity, centered
];

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
  private fieldKeys: FieldKey[] = FIELD_KEYS.map((k) => [...k] as FieldKey);

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
      const r = Math.cbrt(Math.random()) * 2.6;
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

    this.resize();
    this.lastNow = performance.now();
    return true;
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

  /** Bind the six formations to measured page-section offsets, so the shape
   *  story stays correct when sticky sections or CMS content change the
   *  document height. */
  setSectionAnchors(anchors: number[]) {
    if (anchors.length !== this.fieldKeys.length || anchors.some((v) => !Number.isFinite(v))) {
      return;
    }
    let previous = -0.001;
    this.fieldKeys = FIELD_KEYS.map((key, index) => {
      const progress = Math.max(previous + 0.001, Math.min(1, Math.max(0, anchors[index])));
      previous = progress;
      return [progress, key[1], key[2], key[3], key[4]];
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
    const yaw = this.yaw + (this.pointer[0] - 0.5) * 0.22;
    const pitch = this.pitch + (this.pointer[1] - 0.5) * 0.14;
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
      for (const t of [this.posA, this.posB, this.velA, this.velB, this.sceneTex]) {
        if (t) gl.deleteTexture(t);
      }
      if (this.simFbo) gl.deleteFramebuffer(this.simFbo);
      if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
      if (this.vao) gl.deleteVertexArray(this.vao);
    }
    this.simProg = this.pointProg = this.showProg = null;
    this.posA = this.posB = this.velA = this.velB = this.sceneTex = null;
    this.simFbo = this.sceneFbo = null;
    this.vao = null;
    this.gl = null;
    this.canvas = null;
  }

  /** Fractional formation index for a scroll position. */
  private shapeAt(p: number): number {
    const keys = this.fieldKeys;
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i][0] && p <= keys[i + 1][0]) {
        const span = keys[i + 1][0] - keys[i][0] || 1;
        return i + smootherstep((p - keys[i][0]) / span);
      }
    }
    return p < keys[0][0] ? 0 : keys.length - 1;
  }

  /** Interpolate [centerX, centerY, scale, exposure] at the current progress. */
  private frameAt(p: number): [number, number, number, number] {
    const keys = this.fieldKeys;
    let k0 = keys[0];
    let k1 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (p >= keys[i][0] && p <= keys[i + 1][0]) {
        k0 = keys[i];
        k1 = keys[i + 1];
        break;
      }
    }
    const span = k1[0] - k0[0] || 1;
    const u = smootherstep((p - k0[0]) / span);
    return [
      k0[1] + (k1[1] - k0[1]) * u,
      k0[2] + (k1[2] - k0[2]) * u,
      k0[3] + (k1[3] - k0[3]) * u,
      k0[4] + (k1[4] - k0[4]) * u,
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
    const [cx, cy, scale, exposure] = this.frameAt(this.progress);
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
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uExposure"), 1.75 * exposure);
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
    this.yaw += dt * 0.06 * (1 - steering);

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

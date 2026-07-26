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
  brightPassShader,
  blurShader,
  displayShader,
} from "./shader";
import {
  applyRendererClass,
  classifyRenderer,
  getSafeCanvasSize,
  PerfGovernor,
  type LatentProfile,
  type RendererClass,
} from "./quality";

export interface LatentOptions {
  /** Opening quality bid, from selectLatentProfile. The engine narrows it once
   *  the GPU's own renderer string is known. */
  profile: LatentProfile;
  /** Called when the field gives up — the caller should show its fallback. */
  onGiveUp?: () => void;
}

/** What the engine ended up doing, for the debug overlay and for support. */
export interface LatentDiagnostics {
  profile: string;
  renderer: string;
  rendererClass: RendererClass;
  particles: number;
  step: number;
  renderScale: number;
  fpsCap: number;
  fps: number;
  bufferW: number;
  bufferH: number;
}

// Focal length, mirrored from pointVertexShader. The camera distance is no
// longer a constant — each section is framed from its own dolly position — so
// the pointer projection recomputes its plane from the current shot.
const FOCAL = 1.45;

/**
 * One camera setup per formation. Scrolling the page moves the camera between
 * them, so each section is a different SHOT of the same subject rather than the
 * same view with different dots in it.
 *
 *  cx, cy   NDC offset — on desktop the field sits right of the copy
 *  scale    field size in view units
 *  exposure compensates for how tightly the formation packs its particles
 *  yaw      studio azimuth, added on top of the idle drift and the user's drag
 *  pitch    elevation
 *  camZ     dolly distance — small is a tight shot, large is a wide one
 *  roll     a few tenths of a degree of dutch, enough to kill the CG symmetry
 */
interface Shot {
  cx: number;
  cy: number;
  scale: number;
  exposure: number;
  yaw: number;
  pitch: number;
  camZ: number;
  roll: number;
}

const SHOTS: Shot[] = [
  // hero — the latent core, three-quarter view so the rim light catches an edge
  { cx: 0.36, cy: 0.02, scale: 1.0, exposure: 1.28, yaw: -0.42, pitch: 0.16, camZ: 3.15, roll: -0.012 },
  // brojevi — a flat plane needs an angled camera or it reads as wallpaper
  { cx: 0.3, cy: 0.06, scale: 0.88, exposure: 1.55, yaw: 0.55, pitch: 0.3, camZ: 3.3, roll: 0.02 },
  // rezultati — a compact ribbon packs its particles hard; it clips first
  { cx: 0.0, cy: 0.1, scale: 1.12, exposure: 0.7, yaw: -0.3, pitch: -0.18, camZ: 3.05, roll: -0.02 },
  // paketi — three masses, held far enough apart to keep the gaps legible
  { cx: 0.28, cy: 0.04, scale: 1.0, exposure: 1.05, yaw: 0.38, pitch: 0.12, camZ: 3.28, roll: 0.014 },
  // edukacija — widest footprint, so the widest lens and the least exposure
  { cx: 0.3, cy: 0.06, scale: 1.04, exposure: 0.88, yaw: -0.5, pitch: 0.22, camZ: 3.45, roll: -0.016 },
  // booking — everything collapses inward; push in for the close-up. Densest
  // formation of the set, hence the lowest exposure of the set.
  { cx: 0.0, cy: 0.06, scale: 0.92, exposure: 0.72, yaw: 0.2, pitch: -0.1, camZ: 2.85, roll: 0.008 },
  // finale — the wordmark, dead square: letterforms only read face-on
  { cx: 0.0, cy: 0.04, scale: 1.1, exposure: 0.76, yaw: 0.0, pitch: 0.0, camZ: 3.2, roll: 0.0 },
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
  private maxRenderPixels = 5_000_000;
  private maxTextureSize = 4096;
  private renderDpr = 1;

  // Runtime quality. The governor owns these; resize() reads renderScale and
  // the loop reads fpsCap.
  private governor: PerfGovernor | null = null;
  private renderScale = 1;
  private fpsCap = 60;
  private onGiveUp?: () => void;
  private fps = 0;
  private profileName = "high";
  private renderer = "";
  private rendererClass: RendererClass = "unknown";

  private dim = 512;
  private count = 512 * 512;

  private simProg: WebGLProgram | null = null;
  private pointProg: WebGLProgram | null = null;
  private brightProg: WebGLProgram | null = null;
  private blurProg: WebGLProgram | null = null;
  private showProg: WebGLProgram | null = null;

  private posA: WebGLTexture | null = null;
  private posB: WebGLTexture | null = null;
  private velA: WebGLTexture | null = null;
  private velB: WebGLTexture | null = null;
  private wordTex: WebGLTexture | null = null;
  private simFbo: WebGLFramebuffer | null = null;
  private sceneFbo: WebGLFramebuffer | null = null;
  private sceneTex: WebGLTexture | null = null;
  // Bloom chain, quarter resolution. A is the threshold target and the final
  // result; B is the intermediate the horizontal blur writes into.
  private bloomTexA: WebGLTexture | null = null;
  private bloomTexB: WebGLTexture | null = null;
  private bloomFbo: WebGLFramebuffer | null = null;
  private bloomW = 0;
  private bloomH = 0;
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

  // Idle camera move, on top of the per-shot setup. A camera that only spins at
  // a constant rate reads as a turntable GIF; a slow elevation bob, a hint of
  // roll and a trace of handheld read as an operator. All three are suspended
  // as the wordmark squares up.
  private bobPitch = 0;
  private bobRoll = 0;
  private bobYaw = 0;
  private breath = 0;

  mount(canvas: HTMLCanvasElement, options: LatentOptions): boolean {
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

    // What the GPU actually is. Every pre-flight signal in quality.ts is a CPU
    // signal; this is the only one that describes the part doing the work, and
    // it is what keeps a fast-CPU/integrated-GPU laptop from being handed a
    // quarter-million particles it can only draw at six frames a second.
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    this.renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl.getParameter(gl.RENDERER) ?? "");
    this.rendererClass = classifyRenderer(this.renderer);
    const profile = applyRendererClass(options.profile, this.rendererClass);
    // Software rasteriser: there is no setting at which this is worth drawing.
    if (!profile) return false;

    this.profileName = profile.name;
    this.dim = profile.texDim;
    this.count = this.dim * this.dim;
    this.maxDpr = profile.maxDpr;
    this.maxRenderPixels = profile.maxRenderPixels;
    this.onGiveUp = options.onGiveUp;
    this.governor = new PerfGovernor(profile.startStep);
    this.renderScale = this.governor.state.renderScale;
    this.fpsCap = this.governor.state.fpsCap;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (this.dim > this.maxTextureSize) return false;

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
    this.brightProg = link(fullscreenVertexShader, brightPassShader);
    this.blurProg = link(fullscreenVertexShader, blurShader);
    this.showProg = link(fullscreenVertexShader, displayShader);
    if (!this.simProg || !this.pointProg || !this.brightProg || !this.blurProg || !this.showProg) {
      return false;
    }

    this.gl = gl;
    this.canvas = canvas;
    this.vao = gl.createVertexArray();
    this.simFbo = gl.createFramebuffer();
    this.sceneFbo = gl.createFramebuffer();
    this.bloomFbo = gl.createFramebuffer();

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
    if (!this.posA || !this.posB || !this.velA || !this.velB || !this.simulationTargetReady()) {
      this.dispose();
      return false;
    }

    this.buildWordmark();
    // The display face almost never wins the race with mount, so rebuild once
    // it lands — otherwise the finale is set in the fallback serif.
    document.fonts?.ready.then(() => {
      if (this.gl) this.buildWordmark();
    });

    if (!this.resize()) {
      this.dispose();
      return false;
    }
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
    // Discard a stale error so the allocation check describes this texture.
    gl.getError();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    if (gl.getError() !== gl.NO_ERROR) {
      gl.deleteTexture(t);
      return null;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Verify the exact two-target float layout, not only the advertised extension. */
  private simulationTargetReady(): boolean {
    const gl = this.gl;
    if (!gl || !this.simFbo || !this.posB || !this.velB) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.posB, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velB, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const ready = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ready;
  }

  start() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.lastNow = performance.now();
    this.loop();
  }

  /** What the engine settled on. Surfaced so a machine where the field misbehaves
   *  can be diagnosed from the page itself instead of by guesswork. */
  getDiagnostics(): LatentDiagnostics {
    return {
      profile: this.profileName,
      renderer: this.renderer,
      rendererClass: this.rendererClass,
      particles: this.count,
      step: this.governor?.level ?? 0,
      renderScale: this.renderScale,
      fpsCap: this.fpsCap,
      fps: Math.round(this.fps),
      bufferW: this.canvas?.width ?? 0,
      bufferH: this.canvas?.height ?? 0,
    };
  }

  /** Walk the quality ladder from measured frame times. */
  private govern(frameMs: number) {
    const g = this.governor;
    if (!g) return;
    this.fps += (1000 / Math.max(frameMs, 1) - this.fps) * 0.1;
    const verdict = g.sample(frameMs);
    if (verdict === "hold") return;
    if (verdict === "abort") {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[latent] giving up — ${this.renderer || "unknown GPU"} cannot hold the field`);
      }
      this.pause();
      this.onGiveUp?.();
      return;
    }
    const next = g.state;
    this.fpsCap = next.fpsCap;
    if (next.renderScale !== this.renderScale) {
      this.renderScale = next.renderScale;
      if (!this.resize()) {
        this.pause();
        this.onGiveUp?.();
      }
    }
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[latent] step ${g.level} — scale ${next.renderScale}, cap ${next.fpsCap}fps`,
      );
    }
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
    if (ranges.length !== SHOTS.length) return;
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

  /** Rotation for the current orbit, as a column-major mat3.
   *
   *  Three things stack here: the shot's own camera setup, the idle move, and
   *  the user's drag. Pointer parallax is added rather than accumulated, so it
   *  leans and returns.
   *
   *  Roll is what makes the frame stop looking rendered. It is a fraction of a
   *  degree — enough that the horizon is never exactly level, not enough to
   *  notice as a tilt. */
  private buildRot() {
    const lean = 1 - this.faceOn;
    const shot = this.layout();
    const yaw = this.yaw + (shot.yaw + this.bobYaw) * lean + (this.pointer[0] - 0.5) * 0.22 * lean;
    const pitch =
      this.pitch + (shot.pitch + this.bobPitch) * lean + (this.pointer[1] - 0.5) * 0.14 * lean;
    const roll = (shot.roll + this.bobRoll) * lean;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    // R = Rz(roll) * Rx(pitch) * Ry(yaw), written out column by column.
    const r = this.rot;
    r[0] = cr * cy - sr * sp * sy;
    r[1] = sr * cy + cr * sp * sy;
    r[2] = -cp * sy;
    r[3] = -sr * cp;
    r[4] = cr * cp;
    r[5] = sp;
    r[6] = cr * sy + sr * sp * cy;
    r[7] = sr * sy - cr * sp * cy;
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

  resize(): boolean {
    const canvas = this.canvas;
    const gl = this.gl;
    if (!canvas || !gl || !this.sceneFbo) return false;
    // renderScale rides on top of the profile's budget. Fill rate is the
    // bottleneck in every pass after the simulation, so dropping resolution is
    // the cheapest way to buy frames — and on a field this soft it is the
    // change a viewer is least likely to notice.
    const s = this.renderScale;
    const { width, height, dpr } = getSafeCanvasSize({
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      maxDpr: this.maxDpr * s,
      maxTextureSize: this.maxTextureSize,
      maxRenderPixels: this.maxRenderPixels * s * s,
    });
    this.renderDpr = dpr;
    if (canvas.width === width && canvas.height === height && this.sceneTex) return true;

    const previous = this.sceneTex;
    canvas.width = width;
    canvas.height = height;
    // LINEAR, not NEAREST: the bright pass downsamples this and the display
    // pass reads it at sub-pixel offsets for the chromatic aberration.
    const t = this.colorTex(gl, width, height);
    if (!t) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    const ready = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ready) {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        previous,
        0,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteTexture(t);
      return false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.sceneTex = t;
    if (previous) gl.deleteTexture(previous);

    // Bloom runs at quarter resolution. The blur radius is measured in source
    // texels, so a smaller buffer buys a wider bleed for less fill — and the
    // result is blurred anyway, so the detail is not missed.
    const bw = Math.max(1, width >> 2);
    const bh = Math.max(1, height >> 2);
    const a = this.colorTex(gl, bw, bh);
    const b = this.colorTex(gl, bw, bh);
    if (!a || !b) {
      if (a) gl.deleteTexture(a);
      if (b) gl.deleteTexture(b);
      // The scene target is live either way; drop bloom and keep rendering.
      this.bloomW = this.bloomH = 0;
      return true;
    }
    if (this.bloomTexA) gl.deleteTexture(this.bloomTexA);
    if (this.bloomTexB) gl.deleteTexture(this.bloomTexB);
    this.bloomTexA = a;
    this.bloomTexB = b;
    this.bloomW = bw;
    this.bloomH = bh;
    return true;
  }

  /** RGBA16F render target with linear filtering. */
  private colorTex(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture | null {
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.getError();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    if (gl.getError() !== gl.NO_ERROR) {
      gl.deleteTexture(t);
      return null;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
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
      for (const p of [this.simProg, this.pointProg, this.brightProg, this.blurProg, this.showProg]) {
        if (p) gl.deleteProgram(p);
      }
      for (const t of [
        this.posA,
        this.posB,
        this.velA,
        this.velB,
        this.sceneTex,
        this.wordTex,
        this.bloomTexA,
        this.bloomTexB,
      ]) {
        if (t) gl.deleteTexture(t);
      }
      if (this.simFbo) gl.deleteFramebuffer(this.simFbo);
      if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
      if (this.bloomFbo) gl.deleteFramebuffer(this.bloomFbo);
      if (this.vao) gl.deleteVertexArray(this.vao);
    }
    this.simProg = this.pointProg = this.brightProg = this.blurProg = this.showProg = null;
    this.posA = this.posB = this.velA = this.velB = this.sceneTex = this.wordTex = null;
    this.bloomTexA = this.bloomTexB = null;
    this.simFbo = this.sceneFbo = this.bloomFbo = null;
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

  /** Interpolate the camera setup for a fractional shape index. Keyed off the
   *  shape rather than raw progress so the framing can never drift out of step
   *  with the formation it is framing — the camera move and the morph are the
   *  same gesture. */
  private frameAt(shape: number): Shot {
    const last = SHOTS.length - 1;
    const i0 = Math.max(0, Math.min(last, Math.floor(shape)));
    const i1 = Math.min(last, i0 + 1);
    const u = smootherstep(shape - i0);
    const a = SHOTS[i0];
    const b = SHOTS[i1];
    const mix = (x: number, y: number) => x + (y - x) * u;
    return {
      cx: mix(a.cx, b.cx),
      cy: mix(a.cy, b.cy),
      scale: mix(a.scale, b.scale),
      exposure: mix(a.exposure, b.exposure),
      yaw: mix(a.yaw, b.yaw),
      pitch: mix(a.pitch, b.pitch),
      camZ: mix(a.camZ, b.camZ),
      roll: mix(a.roll, b.roll),
    };
  }

  /** Advance the particle state by dt (MRT into the back position/velocity
   *  textures, then swap). */
  private simulate(dt: number) {
    const gl = this.gl;
    if (!gl || !this.simProg || !this.canvas) return;

    const { cx, cy, scale, camZ } = this.layout();
    // Pointer -> VIEW units on the z=0 plane, matching pointVertexShader. The
    // shader compares this against uRot*p, so no inverse is needed here; the
    // scale divide keeps the cursor's reach constant as the field resizes, and
    // the plane is recomputed from the current dolly so a tighter shot does not
    // silently widen the cursor's reach.
    const aspect = this.canvas.width / this.canvas.height;
    const plane = FOCAL / camZ;
    const ptrX = ((this.pointer[0] * 2 - 1 - cx) * aspect) / plane / scale;
    const ptrY = (this.pointer[1] * 2 - 1 - cy) / plane / scale;

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
    const toViewX = (n: number) => ((n * 2 - 1 - cx) * aspect) / plane / scale;
    const toViewY = (n: number) => (n * 2 - 1 - cy) / plane / scale;
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
  private layout(): Shot {
    const canvas = this.canvas!;
    const shot = this.frameAt(this.shape);
    // The dolly breathes a few centimetres either way. Barely perceptible on
    // its own; what it removes is the sense that the camera is bolted down.
    shot.camZ += this.breath;
    if (canvas.width / canvas.height < 0.85) {
      shot.cx *= 0.2;
      shot.cy = shot.cy * 0.25 - 0.42;
      shot.scale *= 0.72;
      return shot;
    }
    if (canvas.clientWidth < 1024) {
      shot.cx = shot.cx * 0.5 + 0.32;
      shot.cy = shot.cy * 0.3 - 0.4;
      shot.scale *= 0.62;
      return shot;
    }
    return shot;
  }

  private draw() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.pointProg || !this.showProg) return;
    const brightProg = this.brightProg;
    const blurProg = this.blurProg;

    const { cx, cy, scale, exposure, camZ } = this.layout();
    // Calibrated by rendering every formation settled and reading back the
    // histogram: at this base the densest region of the densest formation
    // reaches ~250/255 without clipping, so the tonemap's shoulder is fully
    // used and no core flattens into a white disc. The per-formation factor
    // corrects for how tightly each one packs its particles.
    //
    // Exposure also rides the boot ramp. Scattered across the whole viewport
    // the particles cover far more area than any settled formation, so at full
    // exposure the opening is a white blizzard that buries the hero copy. Dim
    // at first, brightening as the field gathers: the page resolves out of the
    // dark instead of flashing.
    //
    // Squared, with a very low floor: scattered over the viewport the cloud
    // covers roughly three times the area of any settled formation, so a
    // linear fade still opens brighter than the finished hero.
    // Nudged up from 3.0 to pay for the deeper shadows in the rig: dropping the
    // ambient floor took real light out of the frame, and the grade's contrast
    // curve takes a little more.
    const exp = 3.3 * exposure * (0.06 + 0.94 * this.boot * this.boot);

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
    // Wider sprites than the point cloud strictly needs. Tight ones leave the
    // field reading as static: individual particles resolve and the form looks
    // like sandpaper rather than like a lit volume. Overlapping them is what
    // turns the dust into a surface — the fragment shader conserves energy, so
    // the extra area costs level, not detail.
    // Widened again: bigger, softer, more overlapped sprites are what separate
    // "a lit volume" from "a lot of small bright dots". Small dots are the
    // geometry of glitter — you can resolve each one, so each one twinkles.
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uPxScale"), 1.95 * this.renderDpr);
    // Exposure was calibrated against 512x512 particles; keep the HDR buffer
    // receiving the same total light when mobile drops to 256x256.
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uGain"), (512 * 512) / this.count);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, "uCenter"), cx, cy);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uScale"), scale);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uCamZ"), camZ);
    // Focus sits on the field's centre plane, with a slow drift either side of
    // it. A perfectly static focal plane is the one part of a camera move a
    // viewer notices as mechanical.
    gl.uniform1f(
      gl.getUniformLocation(this.pointProg, "uFocus"),
      camZ + Math.sin(this.animTime * 0.077) * 0.06,
    );
    // Shallower than before. Depth of field is the most expensive-looking cue
    // available and it is also a de-glitterer: an out-of-focus particle is a
    // soft disc that cannot twinkle, so only the focal band is allowed to be
    // crisp at all.
    gl.uniform1f(gl.getUniformLocation(this.pointProg, "uCoc"), 0.72);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.pointProg, "uRot"), false, this.buildRot());
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);

    gl.disable(gl.BLEND);

    // ---- bloom: threshold, then two separable blur passes ----
    const bloomA = this.bloomTexA;
    const bloomB = this.bloomTexB;
    const hasBloom = !!(this.bloomW > 0 && bloomA && bloomB && this.bloomFbo && brightProg && blurProg);
    if (hasBloom && bloomA && bloomB && brightProg && blurProg) {
      const bw = this.bloomW;
      const bh = this.bloomH;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFbo);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      gl.viewport(0, 0, bw, bh);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bloomA, 0);
      gl.useProgram(brightProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      gl.uniform1i(gl.getUniformLocation(brightProg, "uScene"), 0);
      gl.uniform2f(gl.getUniformLocation(brightProg, "uTexSize"), bw, bh);
      gl.uniform2f(
        gl.getUniformLocation(brightProg, "uSrcTexel"),
        1 / canvas.width,
        1 / canvas.height,
      );
      gl.uniform1f(gl.getUniformLocation(brightProg, "uExposure"), exp);
      // Raised well past the old 0.72. At that threshold most of the field was
      // above the line, so every particle got its own little halo and the whole
      // frame sparkled. Now only genuinely hot cores bleed — fewer sources,
      // each one much wider. That is the difference between a lit set and a
      // string of fairy lights.
      gl.uniform1f(gl.getUniformLocation(brightProg, "uThreshold"), 0.9);
      gl.uniform1f(gl.getUniformLocation(brightProg, "uKnee"), 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Four passes, two octaves. H+V at radius 1 gives the tight core glow;
      // H+V at radius 3.4 over the same buffer widens it into halation. Both
      // accumulate into A, so the final texture carries a tight highlight
      // sitting inside a broad, very soft pool of light.
      const blurDir = gl.getUniformLocation(blurProg, "uDir");
      const blurRadius = gl.getUniformLocation(blurProg, "uRadius");
      gl.useProgram(blurProg);
      gl.uniform2f(gl.getUniformLocation(blurProg, "uTexSize"), bw, bh);
      gl.uniform1i(gl.getUniformLocation(blurProg, "uSrc"), 0);
      for (const [src, dst, dx, dy, r] of [
        [bloomA, bloomB, 1, 0, 1.0],
        [bloomB, bloomA, 0, 1, 1.0],
        [bloomA, bloomB, 1, 0, 3.4],
        [bloomB, bloomA, 0, 1, 3.4],
      ] as [WebGLTexture, WebGLTexture, number, number, number][]) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dst, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src);
        gl.uniform2f(blurDir, dx, dy);
        gl.uniform1f(blurRadius, r);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    // ---- tonemap and grade to screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.showProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(this.showProg, "uScene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    // Without a bloom chain the sampler still has to be bound to something
    // legal; the scene's own black corners contribute nothing at amount 0.
    gl.bindTexture(gl.TEXTURE_2D, hasBloom ? bloomA : this.sceneTex);
    gl.uniform1i(gl.getUniformLocation(this.showProg, "uBloom"), 1);
    // Higher amount than before even though the threshold went up: far less of
    // the frame qualifies now, so the surviving glow can be strong without
    // washing the whole field. Few and wide, not many and small.
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uBloomAmt"), hasBloom ? 0.52 : 0);
    gl.uniform2f(gl.getUniformLocation(this.showProg, "uTexSize"), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uTime"), this.animTime);
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uExposure"), exp);
    // The offset peaks at q*r2*uCA with |q| = 0.5 and r2 = 0.5, i.e. uCA/4 in
    // uv — about one pixel across a 1440-wide frame.
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uCA"), 0.004);
    // Light: the field is already made of discrete points, so grain on top of
    // it stops reading as stock and starts reading as sandpaper — and any
    // per-frame high-frequency noise feeds straight back into the twinkle this
    // pass exists to remove.
    gl.uniform1f(gl.getUniformLocation(this.showProg, "uGrain"), 0.0045);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const since = now - this.lastNow;
    // Frame cap. Below the cap the loop returns without touching the GPU, so a
    // machine held at 30fps spends half its budget idle instead of queueing
    // work it cannot finish — a steady 30 reads as cinematic, a ragged 45 as
    // broken. Two milliseconds of slack keeps a 60Hz display from beating
    // against a 60fps cap and dropping every other frame.
    if (since < 1000 / this.fpsCap - 2) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    const dt = Math.min(since / 1000, 0.05);
    this.lastNow = now;
    this.govern(since);
    // Aborting mid-frame means the context is being torn down under us.
    if (!this.running || !this.gl) return;

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
    // Drift speed breathes instead of ticking along at a constant rate: a fixed
    // angular velocity is the single clearest tell that a shot is a turntable
    // render rather than a camera on a dolly.
    const driftRate = 0.052 + 0.019 * Math.sin(this.animTime * 0.113);
    this.yaw += dt * driftRate * (1 - steering) * (1 - faceOn);

    // Idle move, layered on top of the shot: a slow elevation bob, a hint of
    // roll on a different period so the two never sync up, and a trace of
    // handheld from two incommensurate sines.
    const t = this.animTime;
    this.bobPitch = 0.055 * Math.sin(t * 0.2244);
    this.bobRoll = 0.014 * Math.sin(t * 0.3306 + 1.7);
    this.bobYaw = 0.008 * Math.sin(t * 0.71) + 0.005 * Math.sin(t * 1.33 + 0.9);
    this.breath = 0.035 * Math.sin(t * 0.0913);
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

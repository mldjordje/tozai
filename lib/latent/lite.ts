// -----------------------------------------------------------------------------
// Lite field — the same scroll story on hardware that cannot run the simulation.
//
//   engine.mount(canvas, { count, maxDpr }) -> false if even 2D is unavailable
//
// The WebGL field is all-or-nothing: a machine without WebGL2, without
// renderable floats, or simply too slow to hold the cheapest quality step used
// to drop straight to a CSS gradient. That gradient reads as a static image,
// which on a landing page whose whole idea is "the field resolves as you
// scroll" is not a degraded experience — it is a missing one.
//
// This is the missing middle. Same formations, same scroll timing, same
// palette; a thousand sprites on a 2D canvas instead of a quarter-million
// GPGPU point masses. No shaders, no float textures, no extensions — it runs
// wherever `getContext("2d")` runs, software rasteriser included.
//
// What is deliberately NOT ported: curl-noise turbulence, the studio lighting
// rig, bloom, the tonemap, drag-to-orbit and the click shockwave. Those cost
// per-particle work that is exactly what these machines do not have.
// -----------------------------------------------------------------------------

/** Mirrors the WebGL camera so both fields frame the formations alike. */
const FOCAL = 1.45;
const CAM_Z = 3.05;
/** Golden angle — the same spiral the shader uses to place shell particles. */
const GOLDEN = 2.399963;
const FORMATIONS = 7;

export interface LiteOptions {
  /** Sprite count. The caller scales this to the machine. */
  count: number;
  /** Backing-buffer ceiling. 2D fill rate is the bottleneck, so this is low. */
  maxDpr: number;
  /** Called when even this cannot hold a watchable rate — show the CSS gradient. */
  onGiveUp?: () => void;
}

export interface LiteDiagnostics {
  particles: number;
  fps: number;
  fpsCap: number;
  bufferW: number;
  bufferH: number;
}

/** Palette, straight off the design tokens: pearl body, accent-soft and accent
 *  as the two blues. Tinting per sprite at draw time would mean a filter or a
 *  composite pass per particle, so each particle is assigned one pre-tinted
 *  sprite at init and keeps it. */
const TINTS = ["#f2f2f4", "#8ba4e0", "#4a76d8"] as const;

export class LiteEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sprites: HTMLCanvasElement[] = [];

  /** Sprites currently drawn. The governor lowers this; it never grows. */
  private count = 0;
  /** Sprites allocated. Target lookups stride by THIS, not by `count` — the
   *  arrays are laid out formation-major and demoting must not reinterpret
   *  them, it must simply stop reading past the first `count` entries. */
  private capacity = 0;
  private maxDpr = 1;
  private dpr = 1;

  /** Live state, xyz interleaved. */
  private pos = new Float32Array(0);
  private vel = new Float32Array(0);
  /** All seven formations, precomputed once: formation-major, xyz interleaved.
   *  Recomputing a formation per frame is the one thing that would make this
   *  more expensive than the drawing it exists to replace. */
  private targets = new Float32Array(0);
  /** Per-particle: which tint, and a phase so the idle drift is not in unison. */
  private tint = new Uint8Array(0);
  private phase = new Float32Array(0);
  private weight = new Float32Array(0);

  private ranges: [number, number][] = [];
  private progress = 0;
  private progressTarget = 0;
  private pointerX = 0.5;
  private pointerY = 0.5;

  private running = false;
  private raf = 0;
  private lastNow = 0;
  private lastDraw = 0;
  private fpsCap = 30;
  private fps = 30;
  private spin = 0;

  /** Frame times since the last verdict, for the demotion ladder below. */
  private samples: number[] = [];
  private warmup = 20;
  private demotions = 0;
  private onGiveUp?: () => void;

  mount(canvas: HTMLCanvasElement, options: LiteOptions): boolean {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return false;

    this.canvas = canvas;
    this.ctx = ctx;
    this.count = Math.max(120, Math.floor(options.count));
    this.maxDpr = Math.max(0.5, options.maxDpr);
    this.onGiveUp = options.onGiveUp;

    this.allocate();
    this.buildFormations();
    this.sprites = TINTS.map((c) => buildSprite(c));
    if (this.sprites.some((s) => s.width === 0)) return false;
    if (!this.resize()) return false;

    // Boot from the hero formation rather than from noise: without turbulence
    // to resolve, a settling cloud just looks like a loading glitch.
    this.targets.subarray(0, this.count * 3).forEach((v, i) => {
      this.pos[i] = v;
    });
    this.lastNow = performance.now();
    return true;
  }

  private allocate() {
    const n = this.capacity = this.count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.targets = new Float32Array(FORMATIONS * n * 3);
    this.tint = new Uint8Array(n);
    this.phase = new Float32Array(n);
    this.weight = new Float32Array(n);
  }

  /** Fill every formation's target array once. Ports of the shader's fCore /
   *  fLattice / fStream / fClusters / fNetwork / fSingularity, plus the
   *  wordmark rasterised from the site's own display face. */
  private buildFormations() {
    const n = this.capacity;
    const word = sampleWordmark(n);

    for (let i = 0; i < n; i++) {
      const h0 = Math.random();
      const h1 = Math.random();
      const h2 = Math.random();
      // Mostly pearl with a blue minority — the field is lit, not coloured.
      this.tint[i] = h2 > 0.86 ? 2 : h2 > 0.62 ? 1 : 0;
      this.phase[i] = Math.random() * Math.PI * 2;

      const k = (i + 0.5) / n;
      const phi = Math.acos(Math.min(1, Math.max(-1, 1 - 2 * k)));
      const th = i * GOLDEN;
      const sp = Math.sin(phi);
      const dx = sp * Math.cos(th);
      const dy = sp * Math.sin(th);
      const dz = Math.cos(phi);

      let f = 0;
      const put = (x: number, y: number, z: number) => {
        const o = (f * n + i) * 3;
        this.targets[o] = x;
        this.targets[o + 1] = y;
        this.targets[o + 2] = z;
        f++;
      };

      // 0 — latent core: a shell with a nucleus inside it.
      const r = h2 < 0.2 ? 0.3 + h0 * 0.34 : 0.95 + h0 * h0 * 0.48;
      put(dx * r, dy * r, dz * r);

      // 1 — lattice: a flat measured plane. The grid is derived from the sprite
      // count so it stays a plane rather than a short wide bar at any density.
      const nx = Math.max(2, Math.round(Math.sqrt(n * 1.7)));
      const ny = Math.max(2, Math.ceil(n / nx));
      put(
        ((i % nx) / nx - 0.5) * 3.3,
        (Math.floor(i / nx) / ny - 0.5) * 1.95,
        (h2 - 0.5) * 0.08,
      );

      // 2 — stream: a long ribbon with a travelling wave.
      const sx = (h0 - 0.5) * 4.1;
      const env = 1 - sx * sx * 0.16;
      put(
        sx,
        (h1 - 0.5) * 0.34 * env + Math.sin(sx * 1.7) * 0.3 + Math.sin(sx * 3.9) * 0.07,
        (h2 - 0.5) * 0.55 * env,
      );

      // 3 — clusters: three separated masses, the gaps carry the meaning.
      const c = Math.floor(h0 * 3);
      const cx = c < 1 ? -1.42 : c < 2 ? 0 : 1.42;
      const cy = c < 1 ? 0.2 : c < 2 ? -0.3 : 0.24;
      const cz = c < 1 ? 0.05 : c < 2 ? 0.18 : -0.12;
      const cr = 0.2 + h1 * h1 * 0.26;
      put(cx + dx * cr, cy + dy * cr, cz + dz * cr);

      // 4 — network: a radial graph held near one plane.
      const B = 14;
      const b = Math.floor(h0 * B);
      const a = b * ((Math.PI * 2) / B) + 0.22 + 0.1 * Math.sin(b * 3.1);
      const t = Math.sqrt(h1);
      const tipX = Math.cos(a) * 1.55;
      const tipY = Math.sin(a) * 1.2;
      const tipZ = Math.sin(b * 2.35) * 0.18;
      const jx = (Math.random() - 0.5) * (0.26 + t * 0.3);
      const jy = (Math.random() - 0.5) * (0.26 + t * 0.3);
      const jz = (Math.random() - 0.5) * 0.1;
      if (h2 > 0.9) {
        put(tipX + jx * 2, tipY + jy * 2, tipZ + jz * 2);
      } else {
        put(tipX * t + jx, tipY * t + jy, tipZ * t + jz);
      }

      // 5 — singularity: one core, a few far outliers.
      const sr = 0.34 + Math.pow(h0, 2.2) * 0.34 + Math.pow(h0, 9) * 1.3;
      put(dx * sr, dy * sr, dz * sr);

      // 6 — the wordmark. Falls back to the singularity when the rasteriser is
      // unavailable, so the finale is never an empty screen.
      if (word) {
        put(word[i * 3], word[i * 3 + 1], word[i * 3 + 2]);
      } else {
        put(dx * sr, dy * sr, dz * sr);
      }

      // Nuclei and branch tips read brighter, the way the shader's node weights
      // do — it is what stops the field looking like even dust.
      this.weight[i] = h2 < 0.2 || h2 > 0.9 ? 1 : 0.78;
    }
  }

  /** Scroll windows during which each formation is held, measured from the DOM
   *  by the caller — identical contract to the WebGL engine. */
  setSectionRanges(ranges: [number, number][]) {
    this.ranges = ranges.slice(0, FORMATIONS);
  }

  setProgress(p: number) {
    this.progressTarget = Math.min(1, Math.max(0, p));
  }

  setPointer(x: number, y: number) {
    this.pointerX = x;
    this.pointerY = y;
  }

  /** Which formation the scroll is on: an integer inside a section's hold
   *  window, a fraction across the gap between two of them. */
  private shape(): number {
    const rs = this.ranges;
    if (rs.length === 0) return 0;
    const p = this.progress;
    for (let i = 0; i < rs.length; i++) {
      if (p <= rs[i][1]) {
        if (p >= rs[i][0] || i === 0) return i;
        const prev = rs[i - 1][1];
        const span = rs[i][0] - prev;
        return span > 1e-6 ? i - 1 + (p - prev) / span : i;
      }
    }
    return rs.length - 1;
  }

  resize(): boolean {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return false;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const bw = Math.max(1, Math.floor(w * this.dpr));
    const bh = Math.max(1, Math.floor(h * this.dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    return true;
  }

  start() {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.lastNow = performance.now();
    this.loop();
  }

  pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume() {
    if (!this.running && this.ctx) this.start();
  }

  /** One settled frame, for prefers-reduced-motion. */
  renderOnce() {
    this.progress = this.progressTarget;
    for (let s = 0; s < 90; s++) this.step(1 / 60);
    this.draw();
  }

  getDiagnostics(): LiteDiagnostics {
    return {
      particles: this.count,
      fps: Math.round(this.fps),
      fpsCap: this.fpsCap,
      bufferW: this.canvas?.width ?? 0,
      bufferH: this.canvas?.height ?? 0,
    };
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();

    // Frame cap. The point of a cap here is not smoothness, it is leaving the
    // rest of the page enough main-thread time to scroll.
    const minGap = 1000 / this.fpsCap - 1;
    if (now - this.lastDraw < minGap) return;
    const frameMs = this.lastDraw ? now - this.lastDraw : 1000 / this.fpsCap;
    this.lastDraw = now;

    this.step(Math.min(0.05, (now - this.lastNow) / 1000));
    this.lastNow = now;
    this.draw();
    this.govern(frameMs);
  };

  /** Spring the field toward the current formation. */
  private step(dt: number) {
    // Scroll is eased here rather than in the caller so a jumped scroll
    // position sweeps through the intermediate formations instead of cutting.
    this.progress += (this.progressTarget - this.progress) * Math.min(1, dt * 3.4);
    this.spin += dt * 0.06;

    const n = this.count;
    const s = this.shape();
    const i0 = Math.min(FORMATIONS - 1, Math.floor(s));
    const i1 = Math.min(FORMATIONS - 1, i0 + 1);
    const raw = s - i0;
    // Smoothstep: a linear cross-fade makes the field appear to accelerate out
    // of one formation and slam into the next.
    const f = raw * raw * (3 - 2 * raw);
    const o0 = i0 * this.capacity * 3;
    const o1 = i1 * this.capacity * 3;

    // Stiff enough to arrive within a section's hold, soft enough to overshoot
    // slightly on the way in — that overshoot is most of the life in this.
    const k = 1 - Math.exp(-dt * 3.6);
    const damp = Math.exp(-dt * 3.2);
    const t = this.lastNow * 0.001;

    for (let i = 0; i < n; i++) {
      const p = i * 3;
      const ph = this.phase[i];
      // A slow, tiny per-particle wander stands in for the curl-noise field.
      // Amplitude is well under the spacing between particles: it should read
      // as the field breathing, not as jitter.
      const wob = 0.016;
      for (let a = 0; a < 3; a++) {
        const target =
          this.targets[o0 + p + a] + (this.targets[o1 + p + a] - this.targets[o0 + p + a]) * f;
        const drift = Math.sin(t * (0.7 + a * 0.13) + ph + a * 2.1) * wob;
        this.vel[p + a] = (this.vel[p + a] + (target + drift - this.pos[p + a]) * k) * damp;
        this.pos[p + a] += this.vel[p + a];
      }
    }
  }

  private draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, W, H);

    // Additive, like the WebGL field's accumulation buffer — overlapping
    // particles brighten instead of occluding, which is what makes a dense
    // formation read as a lit solid rather than as a flat stencil.
    ctx.globalCompositeOperation = "lighter";

    const cx = W * 0.5;
    const cy = H * 0.5;
    // Unit scale from the half-height, then clamped so the widest formation
    // (the ribbon, ~4.1 units) still fits a portrait viewport.
    const scale = Math.min(H * 0.5, W * 0.5 / 2.15);
    const spin = this.spin + (this.pointerX - 0.5) * 0.35;
    const cosS = Math.cos(spin);
    const sinS = Math.sin(spin);
    // A fixed tilt, mirroring the shader's — every formation is symmetric
    // about y = 0 and would otherwise be seen exactly edge-on.
    const tilt = 0.21 + (this.pointerY - 0.5) * 0.12;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    const n = this.count;
    const sprites = this.sprites;
    const base = Math.max(2, scale * 0.030);

    for (let i = 0; i < n; i++) {
      const p = i * 3;
      const x0 = this.pos[p];
      const y0 = this.pos[p + 1];
      const z0 = this.pos[p + 2];

      const xr = x0 * cosS + z0 * sinS;
      const zr = z0 * cosS - x0 * sinS;
      const yr = y0 * cosT - zr * sinT;
      const zz = zr * cosT + y0 * sinT;

      const d = CAM_Z - zz;
      if (d <= 0.2) continue;
      const inv = FOCAL / d;
      const sx = cx + xr * inv * scale;
      const sy = cy - yr * inv * scale;
      const size = base * inv * 1.6;
      if (sx < -size || sy < -size || sx > W + size || sy > H + size) continue;

      // Nearer particles are brighter, which is the only depth cue left once
      // the lighting rig is gone.
      const alpha = Math.min(0.9, this.weight[i] * 0.42 * inv);
      ctx.globalAlpha = alpha;
      const s2 = size * 2;
      ctx.drawImage(sprites[this.tint[i]], sx - size, sy - size, s2, s2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Demotion ladder. Same idea as the WebGL governor and the same reason for
   * the median: one scroll spike must not halve the field. Sprite count is cut
   * first because 2D cost is per-sprite, then the cap, and only a machine that
   * still cannot manage gets handed back to the CSS gradient.
   */
  private govern(frameMs: number) {
    this.fps += (1000 / Math.max(frameMs, 1) - this.fps) * 0.1;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    if (frameMs > 400) return;
    this.samples.push(frameMs);
    if (this.samples.length < 36) return;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.samples.length = 0;
    if (median <= (1000 / this.fpsCap) * 1.6) return;

    this.warmup = 20;
    this.demotions++;
    if (this.demotions === 1) {
      this.count = Math.max(150, Math.floor(this.count * 0.55));
      return;
    }
    if (this.demotions === 2) {
      this.count = Math.max(150, Math.floor(this.count * 0.55));
      this.fpsCap = 20;
      return;
    }
    this.pause();
    this.onGiveUp?.();
  }

  dispose() {
    this.pause();
    this.canvas = null;
    this.ctx = null;
    this.sprites = [];
    this.pos = this.vel = this.targets = this.phase = this.weight = new Float32Array(0);
    this.tint = new Uint8Array(0);
  }
}

/** A soft round sprite, drawn once and blitted per particle. Building the
 *  radial gradient per draw call is what makes naive 2D particle fields slow. */
function buildSprite(color: string): HTMLCanvasElement {
  const S = 32;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) {
    c.width = 0;
    return c;
  }
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  const { r, gr, b } = hexToRgb(color);
  // A hot small core inside a wide soft halo — the shape of the bloom the
  // WebGL field gets from an actual blur chain, baked in for free.
  // Legacy `rgba()` rather than the space-separated form: this code exists for
  // old browsers, and an unparsed colour stop is a silently invisible field.
  const rgba = (a: number) => `rgba(${r},${gr},${b},${a})`;
  g.addColorStop(0, rgba(1));
  g.addColorStop(0.22, rgba(0.55));
  g.addColorStop(0.55, rgba(0.12));
  g.addColorStop(1, rgba(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
}

function hexToRgb(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, gr: (v >> 8) & 255, b: v & 255 };
}

/**
 * Rasterise the wordmark and draw `count` targets from its lit pixels — the
 * same trick the WebGL engine uses, and the reason the finale is set in the
 * site's own display face rather than in an approximation of it.
 */
function sampleWordmark(count: number): Float32Array | null {
  const W = 512;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-instrument")
    .trim();
  const stack = `${family || "Georgia"}, Georgia, serif`;
  const wordmark = "TOZA AI";
  let size = Math.round(H * 0.78);
  ctx.font = `400 ${size}px ${stack}`;
  const maxWidth = W * 0.92;
  const measured = ctx.measureText(wordmark).width;
  if (measured > maxWidth) {
    size = Math.floor((size * maxWidth) / measured);
    ctx.font = `400 ${size}px ${stack}`;
  }
  ctx.fillText(wordmark, W / 2, H * 0.54);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, W, H).data;
  } catch {
    // A tainted or blocked canvas is not worth failing the whole field over.
    return null;
  }

  const lit: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4] > 110) lit.push(i);
  }
  if (lit.length === 0) return null;

  const out = new Float32Array(count * 3);
  const spanX = 2.6;
  const spanY = (spanX * H) / W;
  for (let i = 0; i < count; i++) {
    const hit = lit[(Math.random() * lit.length) | 0];
    const x = hit % W;
    const y = (hit / W) | 0;
    out[i * 3] = ((x + Math.random()) / W - 0.5) * spanX;
    // Canvas y runs down, the field's runs up.
    out[i * 3 + 1] = -((y + Math.random()) / H - 0.5) * spanY;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.11;
  }
  return out;
}

/** Sprite budget for a machine that has already failed the WebGL field. The
 *  ceiling is low on purpose: this runs where nothing else would, and the
 *  governor above only ever moves it down. */
export function selectLiteCount(input: {
  viewportWidth: number;
  viewportHeight: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): number {
  const cores = input.hardwareConcurrency ?? 4;
  const mem = input.deviceMemory ?? 4;
  const small = input.viewportWidth * input.viewportHeight < 900_000;
  if (cores <= 2 || mem <= 2) return small ? 420 : 520;
  if (cores <= 4 || mem <= 4) return small ? 700 : 900;
  return small ? 1000 : 1400;
}

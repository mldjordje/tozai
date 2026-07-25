// Latent-field + liquid-chrome background engine — raw WebGL2, one
// fullscreen-triangle draw per frame, no framebuffers. API shape mirrors
// dropz's lib/fluid engine:
//
//   const engine = new LatentEngine();
//   engine.mount(canvas, { octaves, marchSteps, maxDpr })  -> false if no WebGL2
//   engine.setProgress(p)      // page scroll 0..1 (eased internally)
//   engine.setPointer(x, y)    // normalized 0..1, y up (eased internally)
//   engine.renderOnce(p)       // single static frame (reduced motion)
//   engine.resize(); engine.pause(); engine.resume(); engine.dispose();

import { latentVertexShader, makeLatentFragmentShader } from "./shader";

export interface LatentOptions {
  /** fbm octave count compiled into the shader (3 mobile / 5 desktop). */
  octaves?: number;
  /** Raymarch step cap for the chrome sculpture (28 mobile / 48 desktop). */
  marchSteps?: number;
  /** Device-pixel-ratio cap (1 mobile / 1.5 desktop). */
  maxDpr?: number;
}

// Sculpture choreography: [progress, x, y, scale, morph]. Position is in
// field coords (centered, /min-dim; x+ right, y+ up). The sculpture swaps
// sides as sections alternate text alignment, and each stop re-seeds the
// metaball orbit (morph) so every section meets a different creature.
const BLOB_KEYS: [number, number, number, number, number][] = [
  [0.0, 0.3, 0.04, 0.42, 0.0], // hero — right of the headline
  [0.22, -0.34, 0.02, 0.34, 1.2], // stats — left
  [0.48, 0.32, 0.06, 0.38, 2.3], // proof — right
  [0.72, -0.28, -0.04, 0.33, 3.4], // education — left
  [1.0, 0.0, 0.1, 0.48, 4.6], // booking — center, big and calm
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
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private running = false;
  private maxDpr = 1.5;

  // Eased state — targets are set from events, displayed values chase them
  // in the render loop so scroll/pointer never jump.
  private progressTarget = 0;
  private progress = 0;
  private prevProgress = 0;
  private pointerTarget: [number, number] = [0.5, 0.5];
  private pointer: [number, number] = [0.5, 0.5];
  private energy = 0;

  // Scroll velocity envelope (fast attack, slow release) and the warped
  // clock it drives — hard scrolling accelerates the whole scene.
  private velocity = 0;
  private animTime = 0;
  private lastNow = 0;

  // Cursor-grab (the chrome reaching toward the pointer) and click pulse.
  private grab: [number, number, number] = [0, 0, 0];
  private pulseV = 0;

  // User drag offset (touch): reposition the sculpture in field coords.
  // Eased toward the target so releasing/flinging feels smooth.
  private dragTarget: [number, number] = [0, 0];
  private drag: [number, number] = [0, 0];

  // Pointer trail ring buffer: 4 decaying lenses along the recent cursor
  // path give the field its ink-drag feel.
  private trail = new Float32Array([0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0]);
  private trailIdx = 0;
  private lastTrailAt = 0;

  private uTime: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uProgress: WebGLUniformLocation | null = null;
  private uPointer: WebGLUniformLocation | null = null;
  private uPointerEnergy: WebGLUniformLocation | null = null;
  private uVelocity: WebGLUniformLocation | null = null;
  private uBlobPos: WebGLUniformLocation | null = null;
  private uBlobScale: WebGLUniformLocation | null = null;
  private uMorph: WebGLUniformLocation | null = null;
  private uGrab: WebGLUniformLocation | null = null;
  private uPulse: WebGLUniformLocation | null = null;
  private uTrail: WebGLUniformLocation | null = null;
  private wordmarkTex: WebGLTexture | null = null;

  mount(canvas: HTMLCanvasElement, options: LatentOptions = {}): boolean {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;

    const octaves = options.octaves ?? 5;
    const marchSteps = options.marchSteps ?? 48;
    this.maxDpr = options.maxDpr ?? 1.5;

    const vertex = compile(gl, gl.VERTEX_SHADER, latentVertexShader);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, makeLatentFragmentShader(octaves, marchSteps));
    if (!vertex || !fragment) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    this.gl = gl;
    this.program = program;
    this.canvas = canvas;
    this.uTime = gl.getUniformLocation(program, "uTime");
    this.uResolution = gl.getUniformLocation(program, "uResolution");
    this.uProgress = gl.getUniformLocation(program, "uProgress");
    this.uPointer = gl.getUniformLocation(program, "uPointer");
    this.uPointerEnergy = gl.getUniformLocation(program, "uPointerEnergy");
    this.uVelocity = gl.getUniformLocation(program, "uVelocity");
    this.uBlobPos = gl.getUniformLocation(program, "uBlobPos");
    this.uBlobScale = gl.getUniformLocation(program, "uBlobScale");
    this.uMorph = gl.getUniformLocation(program, "uMorph");
    this.uGrab = gl.getUniformLocation(program, "uGrab");
    this.uPulse = gl.getUniformLocation(program, "uPulse");
    this.uTrail = gl.getUniformLocation(program, "uTrail");

    // Wordmark texture the chrome reflects: repeats horizontally around the
    // sculpture, black padding above/below (T is clamped, so edges stay dark).
    const wm = document.createElement("canvas");
    wm.width = 1024;
    wm.height = 128;
    const ctx = wm.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, wm.width, wm.height);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.font = "700 64px Inter, Arial, sans-serif";
      ctx.fillText("TOZAI", 48, 66);
      ctx.font = "500 40px Inter, Arial, sans-serif";
      ctx.fillText("AI VIDEO", 420, 66);
      ctx.font = "700 64px Inter, Arial, sans-serif";
      ctx.fillText("TOZAI", 736, 66);
    }
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.wordmarkTex = tex;
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "uWordmark"), 0);

    this.resize();
    this.lastNow = performance.now();
    return true;
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

  setPointer(x: number, y: number) {
    const dx = x - this.pointerTarget[0];
    const dy = y - this.pointerTarget[1];
    const speed = Math.hypot(dx, dy);
    // Movement feeds the energy envelope; it decays every frame, so the
    // light dies down when the cursor rests.
    this.energy = Math.min(1, this.energy + speed * 4);
    this.pointerTarget = [x, y];

    // Drop a trail lens every ~90ms of movement.
    const now = performance.now();
    if (speed > 0.001 && now - this.lastTrailAt > 90) {
      this.lastTrailAt = now;
      const i = this.trailIdx * 3;
      this.trail[i] = x;
      this.trail[i + 1] = y;
      this.trail[i + 2] = Math.min(1, 0.35 + speed * 6);
      this.trailIdx = (this.trailIdx + 1) % 4;
    }
  }

  /** Click/tap pulse — the sculpture swells and flares, then relaxes. */
  pulse() {
    this.pulseV = 1;
  }

  /** Drag the sculpture by a normalized field delta (touch reposition). */
  dragBy(dx: number, dy: number) {
    this.dragTarget[0] = Math.max(-0.5, Math.min(0.5, this.dragTarget[0] + dx));
    this.dragTarget[1] = Math.max(-0.55, Math.min(0.55, this.dragTarget[1] + dy));
    // A drag also counts as pointer energy so the field lights up under it.
    this.energy = Math.min(1, this.energy + Math.hypot(dx, dy) * 3);
  }

  /** Draw one static frame — used under prefers-reduced-motion. */
  renderOnce(progress = 0.3) {
    this.progress = this.progressTarget = progress;
    this.animTime = 12.0;
    this.draw();
  }

  resize() {
    const canvas = this.canvas;
    const gl = this.gl;
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
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
    if (gl && this.wordmarkTex) gl.deleteTexture(this.wordmarkTex);
    if (gl && this.program) gl.deleteProgram(this.program);
    this.wordmarkTex = null;
    this.gl = null;
    this.program = null;
    this.canvas = null;
  }

  /** Interpolate the sculpture keyframes at the current progress. */
  private blobAt(p: number): [number, number, number, number] {
    const keys = BLOB_KEYS;
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
    // Pointer parallax: the sculpture leans gently toward the cursor.
    const px = (this.pointer[0] - 0.5) * 0.05;
    const py = (this.pointer[1] - 0.5) * 0.04;
    return [
      k0[1] + (k1[1] - k0[1]) * u + px,
      k0[2] + (k1[2] - k0[2]) * u + py,
      k0[3] + (k1[3] - k0[3]) * u,
      k0[4] + (k1[4] - k0[4]) * u,
    ];
  }

  private draw() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !this.program || !canvas) return;
    let [bx, by, bs, morph] = this.blobAt(this.progress);
    // Portrait screens: a bold jewel floating over the copy. Bigger than
    // before and centred; the user can drag it anywhere (touch).
    if (canvas.width / canvas.height < 0.85) {
      bs *= 0.92;
      by = by * 0.35 + 0.5;
      bx = Math.max(-0.14, Math.min(0.14, bx)) * 0.5;
    }

    // Apply the user's drag offset (eased in the loop).
    bx += this.drag[0];
    by += this.drag[1];

    // Cursor grab: pointer position in sculpture-local coords. Strength
    // ramps as the cursor approaches; the target is clamped near the rim so
    // the reaching cell never detaches from the body.
    const mnDim = Math.min(canvas.width, canvas.height);
    const pfx = ((this.pointer[0] - 0.5) * canvas.width) / mnDim;
    const pfy = ((this.pointer[1] - 0.5) * canvas.height) / mnDim;
    let lx = (pfx - bx) / bs;
    let ly = (pfy - by) / bs;
    const dist = Math.hypot(lx, ly);
    const reach = Math.max(0, Math.min(1, (2.4 - dist) / 1.6));
    if (dist > 1.05) {
      lx *= 1.05 / dist;
      ly *= 1.05 / dist;
    }
    this.grab[0] = lx;
    this.grab[1] = ly;
    this.grab[2] += (reach - this.grab[2]) * 0.08;

    gl.useProgram(this.program);
    gl.uniform1f(this.uTime, this.animTime);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uProgress, this.progress);
    gl.uniform2f(this.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.uPointerEnergy, this.energy);
    gl.uniform1f(this.uVelocity, this.velocity);
    gl.uniform2f(this.uBlobPos, bx, by);
    gl.uniform1f(this.uBlobScale, bs);
    gl.uniform1f(this.uMorph, morph);
    gl.uniform3f(this.uGrab, this.grab[0], this.grab[1], this.grab[2]);
    gl.uniform1f(this.uPulse, this.pulseV);
    gl.uniform3fv(this.uTrail, this.trail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastNow) / 1000, 0.05);
    this.lastNow = now;

    this.progress += (this.progressTarget - this.progress) * 0.07;
    this.pointer[0] += (this.pointerTarget[0] - this.pointer[0]) * 0.1;
    this.pointer[1] += (this.pointerTarget[1] - this.pointer[1]) * 0.1;
    this.drag[0] += (this.dragTarget[0] - this.drag[0]) * 0.14;
    this.drag[1] += (this.dragTarget[1] - this.drag[1]) * 0.14;
    this.energy *= 0.96;

    // Velocity envelope: attack fast on scroll, release slow — the smear
    // lingers for a beat after the wheel stops. Rates are per-second so the
    // envelope behaves the same at any frame rate (or after rAF pauses).
    const rawVel = Math.min(1, (Math.abs(this.progress - this.prevProgress) / Math.max(dt, 1e-3)) * 9);
    this.prevProgress = this.progress;
    const rate = rawVel > this.velocity ? 18 : 2.2;
    this.velocity += (rawVel - this.velocity) * Math.min(1, dt * rate);

    // Warped clock: scrolling hard makes the whole scene surge forward.
    this.animTime += dt * (1 + this.velocity * 2.6);
    this.pulseV *= Math.exp(-dt * 2.8);
    const trailDecay = Math.exp(-dt * 1.9);
    for (let i = 2; i < 12; i += 3) this.trail[i] *= trailDecay;

    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };
}

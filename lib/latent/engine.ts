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

import {
  latentVertexShader,
  makeLatentFragmentShader,
  bloomPrefilterShader,
  bloomBlurShader,
  displayShader,
} from "./shader";

interface FBO {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface LatentOptions {
  /** fbm octave count compiled into the shader (3 mobile / 5 desktop). */
  octaves?: number;
  /** Raymarch step cap for the chrome sculpture (28 mobile / 48 desktop). */
  marchSteps?: number;
  /** Device-pixel-ratio cap (1 mobile / 1.5 desktop). */
  maxDpr?: number;
}

// Sculpture choreography: [progress, x, y, scale, morph, shape]. Position is
// in field coords (centered, /min-dim; x+ right, y+ up). The sculpture swaps
// sides as sections alternate text alignment, re-seeds the orbit (morph), and
// morphs into a distinct primitive per section (shape 0..5 — see shapeSDF):
// 0 blob · 1 crystal · 2 ring · 3 cubes · 4 star · 5 sphere.
const BLOB_KEYS: [number, number, number, number, number, number][] = [
  [0.0, 0.3, 0.04, 0.42, 0.0, 0.0], // hero — liquid blob, right of headline
  [0.16, -0.34, 0.02, 0.34, 1.2, 1.0], // stats — crystal, left
  [0.36, 0.32, 0.06, 0.38, 2.3, 2.0], // proof — ring, right
  [0.56, -0.3, 0.0, 0.36, 3.1, 3.0], // paketi — cubes, left
  [0.76, 0.3, -0.02, 0.34, 3.9, 4.0], // edukacija — star, right
  [1.0, 0.0, 0.1, 0.48, 4.6, 5.0], // booking — calm sphere, center
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
  private uShape: WebGLUniformLocation | null = null;
  private uGrab: WebGLUniformLocation | null = null;
  private uPulse: WebGLUniformLocation | null = null;
  private uTrail: WebGLUniformLocation | null = null;
  private uPost: WebGLUniformLocation | null = null;
  private wordmarkTex: WebGLTexture | null = null;

  // --- HDR post chain (bloom + filmic display). Disabled if the GPU can't
  // render to a float/half-float color buffer; the scene shader then grades
  // itself inline (uPost = 0). ---
  private postOk = false;
  private texType = 0; // HALF_FLOAT
  private sceneFBO: FBO | null = null;
  private bloomA: FBO | null = null;
  private bloomB: FBO | null = null;
  private prefilterProg: WebGLProgram | null = null;
  private blurProg: WebGLProgram | null = null;
  private displayProg: WebGLProgram | null = null;
  private uPfScene: WebGLUniformLocation | null = null;
  private uPfTexSize: WebGLUniformLocation | null = null;
  private uPfThreshold: WebGLUniformLocation | null = null;
  private uPfSoftKnee: WebGLUniformLocation | null = null;
  private uBlTex: WebGLUniformLocation | null = null;
  private uBlTexSize: WebGLUniformLocation | null = null;
  private uBlDir: WebGLUniformLocation | null = null;
  private uDpScene: WebGLUniformLocation | null = null;
  private uDpBloom: WebGLUniformLocation | null = null;
  private uDpTexSize: WebGLUniformLocation | null = null;
  private uDpTime: WebGLUniformLocation | null = null;
  private uDpBloomAmt: WebGLUniformLocation | null = null;
  private uDpVelocity: WebGLUniformLocation | null = null;

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
    this.uShape = gl.getUniformLocation(program, "uShape");
    this.uGrab = gl.getUniformLocation(program, "uGrab");
    this.uPulse = gl.getUniformLocation(program, "uPulse");
    this.uTrail = gl.getUniformLocation(program, "uTrail");
    this.uPost = gl.getUniformLocation(program, "uPost");

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

    this.initPost(gl);

    this.resize();
    this.lastNow = performance.now();
    return true;
  }

  /** Compile + link a fullscreen post program sharing the scene vertex shader. */
  private makeProgram(gl: WebGL2RenderingContext, fragSrc: string): WebGLProgram | null {
    const vs = compile(gl, gl.VERTEX_SHADER, latentVertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    if (!p) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  /** Bring up the bloom + display post chain. Silently degrades to inline
   *  grading (postOk = false) when float render targets are unavailable. */
  private initPost(gl: WebGL2RenderingContext) {
    // Half-float color buffers must be renderable for the HDR chain.
    if (!gl.getExtension("EXT_color_buffer_float")) return;
    this.texType = gl.HALF_FLOAT;
    // LINEAR filtering on half-float needs this on some drivers.
    gl.getExtension("OES_texture_float_linear");

    const pf = this.makeProgram(gl, bloomPrefilterShader);
    const bl = this.makeProgram(gl, bloomBlurShader);
    const dp = this.makeProgram(gl, displayShader);
    if (!pf || !bl || !dp) {
      if (pf) gl.deleteProgram(pf);
      if (bl) gl.deleteProgram(bl);
      if (dp) gl.deleteProgram(dp);
      return;
    }
    this.prefilterProg = pf;
    this.blurProg = bl;
    this.displayProg = dp;
    this.uPfScene = gl.getUniformLocation(pf, "uScene");
    this.uPfTexSize = gl.getUniformLocation(pf, "uTexSize");
    this.uPfThreshold = gl.getUniformLocation(pf, "uThreshold");
    this.uPfSoftKnee = gl.getUniformLocation(pf, "uSoftKnee");
    this.uBlTex = gl.getUniformLocation(bl, "uTex");
    this.uBlTexSize = gl.getUniformLocation(bl, "uTexSize");
    this.uBlDir = gl.getUniformLocation(bl, "uDir");
    this.uDpScene = gl.getUniformLocation(dp, "uScene");
    this.uDpBloom = gl.getUniformLocation(dp, "uBloom");
    this.uDpTexSize = gl.getUniformLocation(dp, "uTexSize");
    this.uDpTime = gl.getUniformLocation(dp, "uTime");
    this.uDpBloomAmt = gl.getUniformLocation(dp, "uBloomAmt");
    this.uDpVelocity = gl.getUniformLocation(dp, "uVelocity");
    this.postOk = true;
  }

  private makeFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO | null {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, this.texType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  private deleteFBO(f: FBO | null) {
    const gl = this.gl;
    if (!gl || !f) return;
    gl.deleteTexture(f.tex);
    gl.deleteFramebuffer(f.fbo);
  }

  /** (Re)allocate the scene + bloom targets for the current canvas size. */
  private resizePost() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.postOk) return;
    this.deleteFBO(this.sceneFBO);
    this.deleteFBO(this.bloomA);
    this.deleteFBO(this.bloomB);
    const w = canvas.width;
    const h = canvas.height;
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    this.sceneFBO = this.makeFBO(gl, w, h);
    this.bloomA = this.makeFBO(gl, bw, bh);
    this.bloomB = this.makeFBO(gl, bw, bh);
    if (!this.sceneFBO || !this.bloomA || !this.bloomB) this.postOk = false;
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
      this.resizePost();
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
    if (gl) {
      if (this.prefilterProg) gl.deleteProgram(this.prefilterProg);
      if (this.blurProg) gl.deleteProgram(this.blurProg);
      if (this.displayProg) gl.deleteProgram(this.displayProg);
      this.deleteFBO(this.sceneFBO);
      this.deleteFBO(this.bloomA);
      this.deleteFBO(this.bloomB);
    }
    this.prefilterProg = this.blurProg = this.displayProg = null;
    this.sceneFBO = this.bloomA = this.bloomB = null;
    this.wordmarkTex = null;
    this.gl = null;
    this.program = null;
    this.canvas = null;
  }

  /** Interpolate the sculpture keyframes at the current progress. Returns
   *  [x, y, scale, morph, shape]. */
  private blobAt(p: number): [number, number, number, number, number] {
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
      k0[5] + (k1[5] - k0[5]) * u,
    ];
  }

  private draw() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !this.program || !canvas) return;
    let [bx, by, bs, morph, shape] = this.blobAt(this.progress);
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

    const post = this.postOk && !!this.sceneFBO && !!this.bloomA && !!this.bloomB;

    // ---- Scene pass: to the HDR target (post) or straight to screen ----
    gl.useProgram(this.program);
    if (post) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO!.fbo);
      gl.viewport(0, 0, this.sceneFBO!.w, this.sceneFBO!.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.wordmarkTex);
    gl.uniform1i(gl.getUniformLocation(this.program, "uWordmark"), 0);
    gl.uniform1f(this.uTime, this.animTime);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uProgress, this.progress);
    gl.uniform2f(this.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(this.uPointerEnergy, this.energy);
    gl.uniform1f(this.uVelocity, this.velocity);
    gl.uniform2f(this.uBlobPos, bx, by);
    gl.uniform1f(this.uBlobScale, bs);
    gl.uniform1f(this.uMorph, morph);
    gl.uniform1f(this.uShape, shape);
    gl.uniform3f(this.uGrab, this.grab[0], this.grab[1], this.grab[2]);
    gl.uniform1f(this.uPulse, this.pulseV);
    gl.uniform3fv(this.uTrail, this.trail);
    gl.uniform1f(this.uPost, post ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!post) return;
    this.renderPost(gl, canvas);
  }

  // Bloom (bright-pass + separable blur) then the filmic display pass. The
  // horizontal blur uses a wider step than the vertical for a subtle
  // anamorphic wide-glow — the cinematic tell.
  private renderPost(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    const scene = this.sceneFBO!;
    const a = this.bloomA!;
    const b = this.bloomB!;

    // Bright-pass: scene -> bloomA (half res).
    gl.useProgram(this.prefilterProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
    gl.viewport(0, 0, a.w, a.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(this.uPfScene, 0);
    gl.uniform2f(this.uPfTexSize, a.w, a.h);
    gl.uniform1f(this.uPfThreshold, 0.62);
    gl.uniform1f(this.uPfSoftKnee, 0.7);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Two blur iterations, ping-ponging a<->b. Wider X step = anamorphic.
    gl.useProgram(this.blurProg);
    gl.uniform2f(this.uBlTexSize, a.w, a.h);
    const passes: [FBO, FBO, number, number][] = [
      [a, b, 2.4, 0.0], // horizontal (wide)
      [b, a, 0.0, 1.0], // vertical
      [a, b, 2.4, 0.0],
      [b, a, 0.0, 1.0],
    ];
    for (const [src, dst, dx, dy] of passes) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.uBlTex, 0);
      gl.uniform2f(this.uBlDir, dx, dy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Bloom now rests in bloomA (last dst).

    // Display: scene + bloom -> screen, ACES + grade + grain + vignette.
    gl.useProgram(this.displayProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(this.uDpScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.uniform1i(this.uDpBloom, 1);
    gl.uniform2f(this.uDpTexSize, canvas.width, canvas.height);
    gl.uniform1f(this.uDpTime, this.animTime);
    gl.uniform1f(this.uDpBloomAmt, 0.85);
    gl.uniform1f(this.uDpVelocity, this.velocity);
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

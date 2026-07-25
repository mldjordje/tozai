// "Latent field + liquid chrome" background — the TOZAI concept.
//
// Layer 1 (field): domain-warped fbm. Scroll denoises latent chaos into
// laminar light — "scroll renders the prompt".
// Layer 2 (sculpture): a raymarched liquid-metal metaball cluster that
// travels across sections, continuously morphing. Scroll VELOCITY smears it
// vertically and accelerates the whole field — the page physically reacts
// to how hard you scroll.
//
// Single pass, no framebuffers. The sculpture is bounded, so the march only
// runs on the pixels near it.

export const latentVertexShader = /* glsl */ `#version 300 es
precision highp float;
void main() {
  // Fullscreen triangle from gl_VertexID — no buffers needed.
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Octave count and march steps are compiled in (mobile gets fewer) — GLSL
// loops with uniform bounds defeat unrolling on some drivers.
export function makeLatentFragmentShader(octaves: number, marchSteps: number): string {
  return /* glsl */ `#version 300 es
precision highp float;

uniform float uTime;          // warped seconds (scroll velocity accelerates it)
uniform vec2  uResolution;    // physical pixels
uniform float uProgress;      // page scroll 0..1, eased upstream
uniform vec2  uPointer;       // normalized 0..1, y up
uniform float uPointerEnergy; // 0..1, recent pointer movement
uniform float uVelocity;      // 0..1, smoothed |scroll speed|
uniform vec2  uBlobPos;       // sculpture center, field coords (centered, /min-dim)
uniform float uBlobScale;     // sculpture radius in field coords
uniform float uMorph;         // sculpture shape phase, grows with progress
uniform float uShape;         // sculpture primitive index 0..5, morphs per section
uniform float uPost;          // 1 when an HDR post chain grades downstream, else 0
uniform vec3  uGrab;          // xy: pointer in sculpture-local coords, z: strength
uniform float uPulse;         // 0..1 click pulse, decays upstream
uniform vec3  uTrail[4];      // pointer trail lenses: xy pos (0..1), z energy
uniform sampler2D uWordmark;  // "TOZAI" band reflected by the chrome

out vec4 outColor;

// --- palette (TOZAI: near-black, deep ink blue, electric #2e6bff, ember) ---
const vec3 BASE   = vec3(0.027, 0.031, 0.043);
const vec3 INK    = vec3(0.055, 0.090, 0.200);
const vec3 ACCENT = vec3(0.180, 0.420, 1.000);
const vec3 GLOW   = vec3(0.620, 0.720, 1.000);
const vec3 EMBER  = vec3(1.000, 0.640, 0.340);

// Filmic ACES approximation — rolls highlights off instead of clipping.
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise, ~[-0.7, 0.7]
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
    mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < ${octaves}; i++) {
    v += a * gnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v * 0.5 + 0.5;
}

// ---------------------------------------------------------------- sculpture

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// --- shape primitives the sculpture morphs between per section ------------
// Each returns an SDF centered at origin, sized to ~0.6 so silhouettes match
// across a morph. uShape blends adjacent primitives so scrolling one section
// to the next physically reshapes the chrome.

// Shape 0 — liquid metaball cluster (hero). uMorph re-seeds the orbit.
float sdBlob(vec3 q, float t) {
  float d = length(q) - (0.55 + 0.05 * sin(t * 0.7) + uPulse * 0.12);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec3 o = vec3(
      cos(t * (0.50 + 0.13 * fi) + fi * 2.4 + uMorph * 1.9),
      sin(t * (0.60 + 0.11 * fi) + fi * 1.7 + uMorph * 1.3),
      0.35 * sin(t * 0.5 + fi * 2.1 + uMorph)
    ) * (0.30 + 0.17 * sin(uMorph + fi * 1.8));
    d = smin(d, length(q - o) - (0.17 + 0.05 * sin(t + fi * 1.4)), 0.30);
  }
  return d;
}

// Shape 1 — faceted crystal (stats).
float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

// Shape 2 — ring / halo (proof).
float sdTorus(vec3 p, vec2 tr) {
  vec2 q = vec2(length(p.xz) - tr.x, p.y);
  return length(q) - tr.y;
}

// Shape 3 — stacked rounded cubes (paketi). Two boxes bridged so it reads
// as a little tower without a second full march branch.
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdCubes(vec3 p, float t) {
  float a = sdRoundBox(p - vec3(0.0, 0.22, 0.0), vec3(0.30), 0.06);
  float b = sdRoundBox(p + vec3(0.0, 0.22, 0.0), vec3(0.40, 0.24, 0.40), 0.06);
  return smin(a, b, 0.10);
}

// Shape 4 — spiky star (edukacija). Radial displacement on a sphere.
float sdStar(vec3 p, float t) {
  vec3 n = normalize(p + 1e-4);
  float sp = sin(5.0 * n.x + t) * sin(5.0 * n.y - t) * sin(5.0 * n.z + t * 0.5);
  return length(p) - 0.5 - 0.16 * sp;
}

// Shape 5 — calm sphere (booking).
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float shapeSDF(vec3 q, float t, int k) {
  if (k <= 0) return sdBlob(q, t);
  if (k == 1) return sdOctahedron(q, 0.66);
  if (k == 2) return sdTorus(q, vec2(0.40, 0.17));
  if (k == 3) return sdCubes(q, t);
  if (k == 4) return sdStar(q, t);
  return sdSphere(q, 0.55 + 0.03 * sin(t * 0.7) + uPulse * 0.1);
}

// Sculpture SDF: tumble + velocity smear applied to all shapes, then blend
// the two primitives around uShape so the form morphs across sections.
float map(vec3 q, float t) {
  vec3 q0 = q; // pre-tumble space, where the grab cell lives
  q.y /= 1.0 + uVelocity * 0.55;
  // Slow tumble on two axes so facets/holes catch the light as it turns.
  float ca = cos(t * 0.3), sa = sin(t * 0.3);
  q.xy = mat2(ca, -sa, sa, ca) * q.xy;
  float cb = cos(t * 0.21), sb = sin(t * 0.21);
  q.yz = mat2(cb, -sb, sb, cb) * q.yz;

  float si = clamp(uShape, 0.0, 5.0);
  int i0 = int(floor(si));
  int i1 = min(i0 + 1, 5);
  float fr = smoothstep(0.0, 1.0, fract(si));
  float d = mix(shapeSDF(q, t, i0), shapeSDF(q, t, i1), fr);

  // Cursor grab: a cell reaches out toward the pointer and the wide smin
  // bridges it back to the body — the chrome "licks" at the cursor.
  if (uGrab.z > 0.001) {
    float dg = length(q0 - vec3(uGrab.xy, -0.15)) - 0.20 * uGrab.z;
    d = smin(d, dg, 0.38);
  }
  return d * 0.7; // distortion safety factor (shapes blend + displace)
}

vec3 sceneNormal(vec3 p, float t) {
  const vec2 e = vec2(0.004, -0.004);
  return normalize(
    e.xyy * map(p + e.xyy, t) + e.yyx * map(p + e.yyx, t) +
    e.yxy * map(p + e.yxy, t) + e.xxx * map(p + e.xxx, t)
  );
}

// Procedural chrome environment. Chrome is only as good as what it
// reflects, so the fake sky is high-contrast: near-black floor, white
// zenith, anisotropic accent streaks, hot horizon line.
vec3 envMap(vec3 e, float warm) {
  vec3 env = mix(INK * 0.9, GLOW * 1.25, smoothstep(-0.15, 0.75, e.y));
  env = mix(env, vec3(1.05), smoothstep(0.55, 0.95, e.y) * 0.8);
  float ang = atan(e.x, e.z);
  float streak = 0.5 + 0.5 * gnoise(vec2(ang * 2.2, e.y * 6.0));
  vec3 streakC = mix(ACCENT, EMBER, warm);
  env += streakC * pow(streak, 2.0) * 1.5;
  env += mix(GLOW, EMBER, warm) * pow(1.0 - abs(e.y), 8.0) * 1.4;
  // The wordmark lives in the environment, drifting slowly around the
  // sculpture — "TOZAI" surfaces in the reflections as the chrome turns.
  float band = smoothstep(0.55, 0.2, abs(e.y));
  // Negative u so the wordmark reads forward in the mirrored reflection.
  vec2 wuv = vec2(-ang / 6.2831 + uTime * 0.014, 0.5 - e.y * 1.9);
  env += mix(GLOW, streakC, 0.4) * texture(uWordmark, wuv).r * band * 1.6;
  return env;
}

void main() {
  float mn = min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / mn;
  float t = uTime * 0.05;
  float prog = clamp(uProgress, 0.0, 1.0);
  float warm = smoothstep(0.78, 1.0, prog);

  // ---------------------------------------------------------------- field
  vec2 flow = vec2(0.0, prog * 2.6);

  vec2 pc = (uPointer - 0.5) * uResolution / mn;
  vec2 toPtr = p - pc;
  float pinf = exp(-dot(toPtr, toPtr) * 9.0) * uPointerEnergy;

  vec2 P = p * 1.35 + flow;
  vec2 q = vec2(fbm(P + vec2(0.0, t)), fbm(P + vec2(5.2, 1.3) - t * 0.7));
  q += toPtr * pinf * 0.6;

  // Pointer trail: decaying lenses along the recent cursor path drag the
  // field like a finger through ink — the fluid-sim feel without an FBO sim.
  float trailGlow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 tp = (uTrail[i].xy - 0.5) * uResolution / mn;
    vec2 tv = p - tp;
    float tinf = exp(-dot(tv, tv) * 11.0) * uTrail[i].z;
    q += tv * tinf * 0.55;
    trailGlow += tinf;
  }
  vec2 r = vec2(
    fbm(P + 2.4 * q + vec2(1.7, 9.2) + t * 1.4),
    fbm(P + 2.4 * q + vec2(8.3, 2.8) - t)
  );
  float f = fbm(P + 2.1 * r);

  // Hero: raw latent static folded into the field, dissolving by mid-page.
  float chaos = 1.0 - smoothstep(0.0, 0.6, prog);
  if (chaos > 0.002) {
    float staticN = fbm(p * 22.0 + vec2(0.0, uTime * 0.6));
    f = mix(f, f * 0.62 + staticN * 0.45, chaos * 0.5);
  }

  // Finale: the field settles into laminar bands — the render resolves.
  float order = smoothstep(0.5, 0.95, prog);
  if (order > 0.002) {
    float bands = 0.5 + 0.5 * sin((p.y + r.y * 1.2 - prog * 3.0) * 7.0);
    f = mix(f, f * (0.55 + 0.45 * bands), order * 0.65);
  }

  // Hue journey: electric blue detours through cyan mid-page, ember at end.
  float mid = smoothstep(0.2, 0.5, prog) * (1.0 - smoothstep(0.55, 0.9, prog));
  vec3 acc = mix(ACCENT, vec3(0.15, 0.80, 1.00), mid * 0.7);

  // Chromatic aberration: vein/crest thresholds split per channel while
  // scrolling — edges fringe red/blue like a lens pushed too hard.
  float shift = uVelocity * 0.30 * (0.25 + length(p));
  vec3 vein = vec3(
    smoothstep(0.48 - shift, 0.88 - shift, f),
    smoothstep(0.48, 0.88, f),
    smoothstep(0.48 + shift, 0.88 + shift, f)
  ) * (0.34 + 0.55 * q.y) * (0.9 + uVelocity * 0.6);
  vec3 crest = vec3(
    smoothstep(0.78 - shift, 0.98 - shift, f),
    smoothstep(0.78, 0.98, f),
    smoothstep(0.78 + shift, 0.98 + shift, f)
  ) * (0.55 + uVelocity * 0.35);

  // Grade: base -> ink body -> electric veins -> white-blue crests.
  // Scroll velocity lifts the whole field — the page "charges up".
  vec3 col = BASE;

  // Deep parallax layer: a second, finer field scrolling at a different
  // rate — background gains depth instead of reading as one flat sheet.
  float f2 = fbm(p * 2.6 + vec2(0.0, prog * 1.2 + t * 0.45) + q * 0.8);
  col += INK * 0.8 * smoothstep(0.62, 0.95, f2);

  col = mix(col, INK * 1.35, smoothstep(0.2, 0.68, f));
  col = mix(col, acc, vein);
  col = mix(col, GLOW, crest);

  // Electric filaments where the two warp channels cross — thin live
  // threads snaking through the field.
  float fil = exp(-abs(r.x - r.y) * 60.0);
  col += acc * fil * (0.22 + uVelocity * 0.45) * smoothstep(0.35, 0.65, f);

  // Cheap bloom on the crests so highlights breathe.
  col += GLOW * crest.g * crest.g * 0.45;

  col += acc * pinf * 0.85 + GLOW * pinf * pinf * 0.6;
  col += acc * trailGlow * 0.4 + GLOW * trailGlow * trailGlow * 0.25;

  // ------------------------------------------------------------ sculpture
  vec2 lp = (p - uBlobPos) / uBlobScale;
  float bd = length(lp);

  // Ambient halo so the chrome reads as a light source in the field.
  vec3 haloC = mix(acc, EMBER, warm);
  col += haloC * exp(-max(bd - 1.0, 0.0) * 3.0) * (0.10 + uPulse * 0.12);

  if (bd < 1.6 + uGrab.z * 0.5) {
    float st = uTime * 0.45;
    vec3 ro = vec3(0.0, 0.0, -2.6);
    vec3 rd = normalize(vec3(lp * 1.05, 2.2));
    float tt = 1.1;
    float minD = 1e3;
    bool hit = false;
    vec3 pos = ro;
    for (int i = 0; i < ${marchSteps}; i++) {
      pos = ro + rd * tt;
      float d = map(pos, st);
      minD = min(minD, d);
      if (d < 0.004) { hit = true; break; }
      tt += d;
      if (tt > 4.4) break;
    }

    if (hit) {
      vec3 n = sceneNormal(pos, st);
      vec3 e = reflect(rd, n);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
      // Chromatic aberration on the reflection itself — R and B sample the
      // environment through slightly bent rays. Flares with scroll/click.
      float caA = (uVelocity * 0.6 + uPulse * 0.5) * 0.16 + fres * 0.012;
      vec3 env;
      env.r = envMap(normalize(e + vec3(caA, 0.0, 0.0)), warm).r;
      env.g = envMap(e, warm).g;
      env.b = envMap(normalize(e - vec3(caA, 0.0, 0.0)), warm).b;

      vec3 bcol = env * (0.30 + 0.70 * fres);
      // Thin-film iridescence riding the grazing angles — the "liquid" tell.
      vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.2 + uMorph * 0.15) + vec3(0.0, 2.1, 4.2));
      bcol += irid * fres * 0.18;
      // Two lights: hard white key + soft halo, section-tinted rim.
      // Velocity juices the specular — the chrome flares while you scroll.
      float kd = max(dot(n, normalize(vec3(0.6, 0.7, -0.5))), 0.0);
      float s2 = pow(max(dot(n, normalize(vec3(-0.5, -0.3, -0.6))), 0.0), 32.0);
      bcol += vec3(1.2) * pow(kd, 64.0) * (1.2 + uVelocity * 1.6 + uPulse * 2.0);
      bcol += GLOW * pow(kd, 10.0) * 0.35;
      bcol += mix(ACCENT, EMBER, warm) * s2 * 0.9;
      // Screen-glow rim from the copy side — ties the chrome to the layout.
      float rim = pow(max(dot(n, normalize(vec3(-0.8, 0.15, -0.4))), 0.0), 6.0);
      bcol += ACCENT * rim * 0.45;

      col = mix(col, bcol, 0.96);
    } else {
      // Near-miss rim halo — softens the silhouette, no MSAA needed.
      col += GLOW * exp(-minD * 34.0) * 0.35;
    }
  }

  // Warmth rises for the booking CTA — cold render finishes warm.
  col = mix(col, col * vec3(1.06, 0.97, 0.88) + EMBER * 0.10 * smoothstep(0.5, 0.95, f), warm);

  if (uPost > 0.5) {
    // HDR out: the bloom + grade passes downstream do the cinematic finish.
    // Only a gentle field-shaped vignette here so bloom respects the edges;
    // highlights stay >1 so they bleed in the bloom prefilter.
    float vig = smoothstep(1.55, 0.32, length(p));
    col *= mix(0.74, 1.06, vig);
    outColor = vec4(max(col, 0.0), 1.0);
    return;
  }

  // Fallback path (no float FBO): tonemap + grade inline so it still reads
  // filmic without the post chain.
  float vig = smoothstep(1.35, 0.3, length(p));
  col *= mix(0.62, 1.0, vig);
  col = aces(col * 1.05);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 0.92 + 0.12 * smoothstep(0.0, 0.5, luma));
  float dn = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dn - 0.5) * (2.0 / 255.0);

  outColor = vec4(col, 1.0);
}
`;
}

// --- HDR post chain (bloom + filmic display) -------------------------------
// Fullscreen-triangle passes sharing the scene vertex shader (gl_VertexID, no
// attributes). Each derives uv from gl_FragCoord / target resolution.

// Bright-pass with soft knee — isolates what should bloom.
export const bloomPrefilterShader = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uTexSize;
uniform float uThreshold;
uniform float uSoftKnee;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec3 c = texture(uScene, uv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * uSoftKnee + 1e-4;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  outColor = vec4(c * contrib, 1.0);
}
`;

// Separable 9-tap gaussian. uDir carries the step (x or y) in texels; the
// horizontal pass is fed a wider step for a subtle anamorphic wide-glow.
export const bloomBlurShader = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec2 o = uDir / uTexSize;
  vec3 sum = texture(uTex, uv).rgb * 0.2270270270;
  sum += texture(uTex, uv + o * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uTex, uv - o * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uTex, uv + o * 3.2307692308).rgb * 0.0702702703;
  sum += texture(uTex, uv - o * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(sum, 1.0);
}
`;

// Final grade: add bloom, ACES tonemap, luma-weighted saturation (deep,
// desaturated shadows; rich cores), animated film grain, soft vignette.
export const displayShader = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uTexSize;
uniform float uTime;
uniform float uBloomAmt;
uniform float uVelocity;
out vec4 outColor;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec3 c = texture(uScene, uv).rgb;
  vec3 bloom = texture(uBloom, uv).rgb;

  // Bloom flares a touch harder while scrolling — the field "charges up".
  c += bloom * (uBloomAmt * (1.0 + uVelocity * 0.8));

  // Filmic tonemap — the single biggest cinematic lift over the raw sum.
  c = aces(c * 1.08);

  // Luma-weighted saturation: crush colour out of the near-black field so it
  // reads as deep charcoal-ink, let highlights keep full electric blue.
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = 0.80 + 0.35 * smoothstep(0.03, 0.45, luma);
  c = mix(vec3(luma), c, sat);

  // Gentle S-curve contrast for that graded look.
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;

  // Animated film grain + cinematic vignette.
  float grain = hash(uv * uTexSize + mod(uTime, 64.0));
  c += (grain - 0.5) * 0.035;
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.65;

  outColor = vec4(max(c, 0.0), 1.0);
}
`;

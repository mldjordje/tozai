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
uniform vec3  uGrab;          // xy: pointer in sculpture-local coords, z: strength
uniform float uPulse;         // 0..1 click pulse, decays upstream
uniform sampler2D uWordmark;  // "TOZAI" band reflected by the chrome

out vec4 outColor;

// --- palette (TOZAI: near-black, deep ink blue, electric #2e6bff, ember) ---
const vec3 BASE   = vec3(0.027, 0.031, 0.043);
const vec3 INK    = vec3(0.055, 0.090, 0.200);
const vec3 ACCENT = vec3(0.180, 0.420, 1.000);
const vec3 GLOW   = vec3(0.620, 0.720, 1.000);
const vec3 EMBER  = vec3(1.000, 0.640, 0.340);

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

// Metaball cluster: one core + 5 orbiting cells. uMorph re-seeds every orbit,
// so each section meets a different creature. Scroll velocity compresses the
// SDF vertically — the chrome smears when you scroll hard.
float map(vec3 q, float t) {
  vec3 q0 = q; // pre-tumble space, where the grab cell lives
  q.y /= 1.0 + uVelocity * 0.55;
  // Slow tumble so the cluster never sits still.
  float ca = cos(t * 0.3), sa = sin(t * 0.3);
  q.xy = mat2(ca, -sa, sa, ca) * q.xy;
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
  // Cursor grab: a cell reaches out toward the pointer and the wide smin
  // bridges it back to the body — the chrome "licks" at the cursor.
  if (uGrab.z > 0.001) {
    float dg = length(q0 - vec3(uGrab.xy, -0.15)) - 0.20 * uGrab.z;
    d = smin(d, dg, 0.38);
  }
  return d * 0.75; // distortion safety factor
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
  col = mix(col, INK * 1.55, smoothstep(0.2, 0.68, f));
  col = mix(col, acc, vein);
  col = mix(col, GLOW, crest);

  col += acc * pinf * 0.85 + GLOW * pinf * pinf * 0.6;

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

  // Vignette + slight lift; dither kills banding on the long dark ramps.
  float vig = smoothstep(1.35, 0.3, length(p));
  col *= mix(0.62, 1.0, vig);
  col = pow(col, vec3(0.92));
  float dn = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dn - 0.5) * (2.0 / 255.0);

  outColor = vec4(col, 1.0);
}
`;
}

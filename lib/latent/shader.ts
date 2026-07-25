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
uniform float uScrollFlow;    // -1..1, signed scroll impulse (+ down, - up)
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

// --- semantic forms the sculpture morphs between per section --------------
// Every form is bounded to roughly the same radius. The object therefore
// changes meaning without "popping" larger and stealing the storm's frame.

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sdTorus(vec3 p, vec2 tr) {
  vec2 q = vec2(length(p.xz) - tr.x, p.y);
  return length(q) - tr.y;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Hero — a directed liquid-intelligence core, not a random metaball cloud.
float sdHeroCore(vec3 p, float t) {
  float breath = 0.018 * sin(t * 0.8) + uPulse * 0.08;
  float d = length(p) - (0.43 + breath);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float a = fi * 1.256637 + t * (0.07 + fi * 0.004) + uMorph * 0.08;
    vec3 axis = normalize(vec3(cos(a), sin(a), 0.55 * sin(a * 1.7 + fi)));
    vec3 node = axis * (0.39 + 0.035 * sin(t * 0.32 + fi));
    float lobe = length(p - node) - (0.175 + 0.012 * sin(t * 0.7 + fi));
    d = smin(d, lobe, 0.19);
  }
  return d;
}

// Brojevi — a central metric core feeding four connected growth nodes.
float sdDataNodes(vec3 p, float t) {
  float sway = 0.025 * sin(t * 0.35);
  vec3 n0 = vec3(-0.44, -0.25 + sway, 0.05);
  vec3 n1 = vec3(-0.23, 0.39, -0.14);
  vec3 n2 = vec3(0.31, 0.35 - sway, 0.09);
  vec3 n3 = vec3(0.46, -0.21, -0.08);
  float d = length(p) - 0.235;
  d = smin(d, sdCapsule(p, vec3(0.0), n0, 0.075), 0.10);
  d = smin(d, sdCapsule(p, vec3(0.0), n1, 0.070), 0.10);
  d = smin(d, sdCapsule(p, vec3(0.0), n2, 0.078), 0.10);
  d = smin(d, sdCapsule(p, vec3(0.0), n3, 0.070), 0.10);
  d = smin(d, length(p - n0) - 0.16, 0.09);
  d = smin(d, length(p - n1) - 0.14, 0.09);
  d = smin(d, length(p - n2) - 0.18, 0.09);
  d = smin(d, length(p - n3) - 0.145, 0.09);
  return d;
}

// Rezultati — a fluid reach portal with signal nodes riding the rim.
float sdSignalPortal(vec3 p, float t) {
  float a = atan(p.z, p.x);
  float major = 0.405 + 0.032 * sin(a * 3.0 - t * 0.28);
  float tube = 0.135 + 0.018 * sin(a * 5.0 + t * 0.4);
  float d = sdTorus(p, vec2(major, tube));
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float na = fi * 2.094395 + t * 0.10;
    vec3 node = vec3(cos(na) * major, 0.035 * sin(t + fi), sin(na) * major);
    d = smin(d, length(p - node) - (0.15 - fi * 0.012), 0.105);
  }
  return d;
}

// Paketi — three interlocked deliverable modules with softened seams.
float sdModules(vec3 p, float t) {
  vec3 a = p - vec3(-0.22, 0.12, 0.02);
  a.xy = rot2(0.18 + 0.025 * sin(t * 0.3)) * a.xy;
  vec3 b = p - vec3(0.23, 0.08, -0.03);
  b.xz = rot2(-0.22) * b.xz;
  vec3 c = p - vec3(0.0, -0.27, 0.08);
  c.yz = rot2(0.16) * c.yz;
  float d = sdRoundBox(a, vec3(0.27, 0.31, 0.28), 0.10);
  d = smin(d, sdRoundBox(b, vec3(0.28, 0.27, 0.30), 0.10), 0.105);
  d = smin(d, sdRoundBox(c, vec3(0.34, 0.23, 0.27), 0.11), 0.09);
  return d;
}

// Edukacija — a compact neural form: knowledge branches stay connected.
float sdKnowledge(vec3 p, float t) {
  float d = length(p) - 0.22;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float a = fi * 1.047198 + 0.08 * sin(t * 0.25 + fi);
    vec3 tip = vec3(
      cos(a) * (0.43 + 0.035 * mod(fi, 2.0)),
      sin(a) * 0.42,
      0.19 * sin(fi * 2.35 + t * 0.12)
    );
    vec3 elbow = tip * 0.58 + vec3(0.0, 0.0, 0.07 * cos(fi));
    d = smin(d, sdCapsule(p, vec3(0.0), elbow, 0.073), 0.09);
    d = smin(d, sdCapsule(p, elbow, tip, 0.055), 0.075);
    d = smin(d, length(p - tip) - (0.125 + 0.012 * mod(fi, 2.0)), 0.08);
  }
  return d;
}

// Booking — the journey resolves into a pearl with a precise equatorial fold.
float sdResolved(vec3 p, float t) {
  float sphere = length(p) - (0.525 + 0.015 * sin(t * 0.45) + uPulse * 0.07);
  vec3 foldP = p;
  foldP.xz = rot2(0.12 * sin(t * 0.12)) * foldP.xz;
  float fold = sdTorus(foldP, vec2(0.51, 0.026));
  return max(sphere, -fold);
}

float shapeSDF(vec3 q, float t, int k) {
  if (k <= 0) return sdHeroCore(q, t);
  if (k == 1) return sdDataNodes(q, t);
  if (k == 2) return sdSignalPortal(q, t);
  if (k == 3) return sdModules(q, t);
  if (k == 4) return sdKnowledge(q, t);
  return sdResolved(q, t);
}

// Sculpture SDF: tumble + velocity smear applied to all shapes, then blend
// the two primitives around uShape so the form morphs across sections.
float map(vec3 q, float t) {
  vec3 q0 = q; // pre-tumble space, where the grab cell lives
  q.y /= 1.0 + uVelocity * 0.38;
  // Weighted two-axis tumble: slow enough to feel machined, never decorative.
  float ca = cos(t * 0.24), sa = sin(t * 0.24);
  q.xy = mat2(ca, -sa, sa, ca) * q.xy;
  float cb = cos(t * 0.16), sb = sin(t * 0.16);
  q.yz = mat2(cb, -sb, sb, cb) * q.yz;

  float si = clamp(uShape, 0.0, 5.0);
  int i0 = int(floor(si));
  int i1 = min(i0 + 1, 5);
  float fr = smoothstep(0.08, 0.92, fract(si));
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

  // ------------------------------------------------------------- stormcloud
  // Cinematic stormcloud: DENSE volumetric fbm lit from within by slow,
  // powerful lightning. Clean — deep ink base, one electric hue; the drama is
  // the strike, which travels slowly through the cloud then flares on landing.

  // Slow drift; scroll nudges the whole cloudscape along its flow.
  vec2 drift = vec2(t * 0.05, -t * 0.03 - prog * 0.55);
  vec2 cp = p * 1.12 + drift;

  // Two-scale fbm cumulonimbus — denser than before (lower threshold, heavier
  // weight) so the sky reads thick and heavy, not wispy.
  float baseN = fbm(cp * 1.3);
  float detail = fbm(cp * 2.85 + baseN * 0.85 + vec2(t * 0.04, 0.0));
  float dens = smoothstep(0.16, 0.84, baseN * 0.72 + detail * 0.5);
  // Storm barely eases toward booking — clouds stay heavy.
  float order = smoothstep(0.6, 1.0, prog);
  dens *= mix(1.0, 0.9, order);

  // Pointer parts the clouds a little where the cursor rests.
  vec2 pc = (uPointer - 0.5) * uResolution / mn;
  vec2 toPtr = p - pc;
  float pinf = exp(-dot(toPtr, toPtr) * 7.0) * uPointerEnergy;
  dens *= 1.0 - pinf * 0.25;

  float f = dens; // downstream warm grade reads cloud density

  // Hue: electric blue, warming to ember as the finale approaches.
  vec3 acc = mix(ACCENT, EMBER, warm);

  // --- main lightning: frequent, powerful, SLOW-traveling leader ----------
  // Each window a leader descends slowly from the crown; when it lands the
  // whole channel flares (return stroke) and lingers — cinematic, not a blink.
  float period = 1.6;                        // frequent, with room to breathe
  float widx = floor(uTime / period);
  float local = fract(uTime / period);
  float rt   = 0.08 + 0.28 * fract(sin(widx * 91.7) * 4390.1); // strike moment
  float seed = fract(sin(widx * 57.3) * 1000.3);               // strike column
  float dtf  = local - rt;                    // cycle time since leader begins

  // Slow descent of the leader front (top -> bottom). Bigger travel = slower.
  float travel = 0.6;
  float fprog = clamp(dtf / travel, 0.0, 1.0);
  float frontY = mix(0.98, -0.98, fprog);
  // Lit only above the descending front — the strike physically travels down.
  float revealed = smoothstep(-0.05, 0.05, p.y - frontY);

  // Energy: dim leader glow while descending, bright return stroke on landing,
  // long afterglow. Slow time constants = the light lingers (cinematic).
  float leaderGlow = exp(-max(dtf, 0.0) * 4.0) * step(0.0, dtf);
  float retStroke  = exp(-(dtf - travel) * (dtf - travel) * 55.0);
  float after      = exp(-max(dtf - travel, 0.0) * 2.2) * step(travel, dtf);
  float boost = 1.25 + uVelocity * 1.5 + uPulse * 1.7;        // stronger overall
  float flash = (leaderGlow * 0.55 + retStroke + after * 0.5) * boost;
  // Resolve the storm around the booking CTA without removing the channel.
  flash *= mix(1.0, 0.48, order);

  // Bolt channel: mostly vertical, forks via fbm down the height.
  float boltX = (seed - 0.5) * 1.15;
  float jag  = (fbm(vec2(p.y * 3.2 + widx * 11.0, widx)) - 0.5) * 0.5;
  jag       += (fbm(vec2(p.y * 8.0 - widx * 5.0, widx)) - 0.5) * 0.18;
  float dxb  = abs(p.x - (boltX + jag));
  float core = exp(-dxb * 150.0) * revealed;   // hot filament, travels down
  float halo = exp(-dxb * 12.0) * 0.55 * revealed; // discharge glow follows leader
  float bolt = (core * 1.2 + halo) * flash;
  float strikeField = exp(-abs(p.x - boltX) * 2.4);

  // --- scroll sparks: small bolts streaking along the scroll flow ---------
  // Only while scrolling. Short vertical discharges ride the signed flow,
  // threaded through the cloud — the page feels alive in either direction.
  float sparks = 0.0;
  if (abs(uScrollFlow) > 0.015) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float lane = floor(uTime * 2.2) + fi * 17.0;
      float sx = (fract(sin(lane * 47.1) * 913.0) - 0.5) * 1.6;
      // Positive flow (scroll down) sweeps crown -> floor; negative reverses.
      float phase = fract(uTime * 0.65 * sign(uScrollFlow) + fi * 0.37);
      float sy = mix(1.05, -1.05, phase);
      float sjag = (fbm(vec2(p.y * 9.0, lane)) - 0.5) * 0.12;
      float horiz = exp(-abs(p.x - sx - sjag) * 42.0);
      float vert  = exp(-abs(p.y - sy) * 7.5);     // compact travelling discharge
      sparks += (horiz + exp(-abs(p.x - sx - sjag - 0.045) * 22.0) * 0.24) * vert;
    }
    sparks *= abs(uScrollFlow) * 1.65;
  }

  // --- compose ------------------------------------------------------------
  vec3 col = BASE;
  // Cloud body: heavier ink volume, accent rim on the dense crowns.
  col = mix(col, INK * 1.25, dens);
  col += acc * smoothstep(0.55, 1.0, dens) * 0.24;
  // Backlight: the strike floods the surrounding cloud from within.
  col += acc * dens * flash * strikeField * 0.82;
  col += GLOW * dens * flash * flash * strikeField * 0.42;
  // The channel + white-hot core.
  col += (GLOW * 1.5 + acc * 0.6) * bolt;
  col += vec3(1.15) * core * flash;
  // Scroll sparks (electric blue-white).
  col += (acc * 1.2 + GLOW * 0.5) * sparks;
  // Faint ambient light where the cursor rests.
  col += acc * pinf * 0.22;

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
      vec3 nGeo = sceneNormal(pos, st);
      float micro = fbm(nGeo.xy * 3.5 + vec2(nGeo.z * 1.7, st * 0.08)) - 0.5;
      vec3 n = normalize(nGeo + vec3(micro * 0.026, -micro * 0.018, micro * 0.022));
      vec3 e = reflect(rd, n);
      float ndv = max(dot(n, -rd), 0.0);
      float fres = pow(1.0 - ndv, 2.35);
      // Chromatic aberration on the reflection itself — R and B sample the
      // environment through slightly bent rays. Flares with scroll/click.
      float caA = (uVelocity * 0.4 + uPulse * 0.35) * 0.065 + fres * 0.008;
      vec3 env;
      env.r = envMap(normalize(e + vec3(caA, 0.0, 0.0)), warm).r;
      env.g = envMap(e, warm).g;
      env.b = envMap(normalize(e - vec3(caA, 0.0, 0.0)), warm).b;

      vec3 bcol = mix(vec3(0.012, 0.018, 0.032), env, 0.34 + fres * 0.60);
      vec3 wideEnv = envMap(normalize(mix(e, n, 0.22)), warm);
      bcol += wideEnv * (0.08 + fres * 0.10);
      // Thin-film iridescence riding the grazing angles — the "liquid" tell.
      vec3 irid = 0.5 + 0.5 * cos(
        6.2831 * (fres * 1.15 + uMorph * 0.11 + micro * 0.08) +
        vec3(0.0, 2.1, 4.2)
      );
      bcol += irid * fres * 0.105;
      // Two lights: hard white key + soft halo, section-tinted rim.
      // Velocity juices the specular — the chrome flares while you scroll.
      float keyDot = max(dot(n, normalize(vec3(0.58, 0.72, -0.46))), 0.0);
      float key = pow(keyDot, 72.0);
      float keyBloom = pow(keyDot, 12.0);
      float coolRim = pow(1.0 - ndv, 4.0);
      float warmRim = pow(
        max(dot(n, normalize(vec3(-0.55, -0.2, -0.8))), 0.0),
        28.0
      );
      bcol += vec3(1.28) * key * (1.0 + uVelocity * 0.55 + uPulse * 0.85);
      bcol += GLOW * keyBloom * 0.22;
      bcol += ACCENT * coolRim * (0.22 + 0.10 * (1.0 - warm));
      bcol += EMBER * warmRim * (0.16 + warm * 0.58);
      // Screen-glow rim from the copy side — ties the chrome to the layout.
      float rim = pow(max(dot(n, normalize(vec3(-0.8, 0.15, -0.4))), 0.0), 7.0);
      bcol += mix(ACCENT, EMBER, warm) * rim * 0.32;

      col = mix(col, bcol, 0.965);
    } else {
      // Near-miss rim halo — softens the silhouette, no MSAA needed.
      col += GLOW * exp(-minD * 34.0) * 0.32;
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

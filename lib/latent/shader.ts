// TOZAI latent field — a GPU particle system, not a fullscreen noise shader.
//
// Every particle is a point mass with velocity. Each section of the page has a
// FORMATION (a target position per particle); scroll interpolates between them.
// A particle springs toward its target, gets pushed around by a curl-noise
// flow, and is repelled by the cursor. Turbulence spikes during a morph and
// decays to ~zero once the field arrives, so the page is mostly still and the
// motion is the transition itself.
//
// Three passes per frame:
//   1. sim     — MRT into (position, velocity) float textures, ping-ponged
//   2. points  — additive gl.POINTS into an HDR buffer, read via texelFetch
//   3. display — exponential tonemap to the screen
//
// The tonemap is not decoration: additive accumulation is unbounded, so dense
// formations clip to flat white without it.

/** Fullscreen triangle from gl_VertexID — no attribute buffers anywhere. */
export const fullscreenVertexShader = /* glsl */ `#version 300 es
precision highp float;
void main() {
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Particle count is compiled in: the formations index particles against the
// total (Fibonacci spheres, lattice strides), so it cannot be a uniform.
export function makeSimShader(count: number): string {
  return /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPos;     // xyz position
uniform sampler2D uVel;     // xyz velocity
uniform vec2  uDim;         // particle texture dimensions
uniform float uTime;
uniform float uDt;
uniform float uShape;       // 0..5, fractional between formations
uniform float uTurb;        // transient turbulence (scroll / morph / click)
uniform float uSettle;      // 0..1, rises while the field is undisturbed
uniform float uPulse;       // 0..1 click shockwave, decays upstream
uniform vec3  uPtr;         // xy in field units, z = cursor strength

layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;

const float N   = ${count}.0;
const float PHI = 2.399963229728653;  // golden angle

vec3 hash3(float n) {
  return fract(sin(vec3(n, n + 17.31, n + 41.77)) * vec3(43758.5453, 22578.145, 19642.349));
}

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  vec4 a = fract(sin(vec4(n, n + 1.0, n + 57.0, n + 58.0)) * 43758.5453);
  vec4 b = fract(sin(vec4(n + 113.0, n + 114.0, n + 170.0, n + 171.0)) * 43758.5453);
  vec4 k = mix(a, b, f.z);
  vec2 m = mix(k.xz, k.yw, f.x);
  return mix(m.x, m.y, f.y) * 2.0 - 1.0;
}

// Curl of a noise potential — a divergence-free flow, so the field swirls
// instead of pooling into sinks. Six taps; the exact curl needs nine and the
// difference is invisible at this scale.
vec3 curl(vec3 p, float t) {
  const float e = 0.35;
  vec3 o2 = vec3(31.4, 17.7, 7.1), o3 = vec3(-9.3, 53.2, 21.8);
  float x = vnoise(p + o2 + vec3(0.0, e, 0.0) + t) - vnoise(p + o2 - vec3(0.0, e, 0.0) + t);
  float y = vnoise(p + o3 + vec3(0.0, 0.0, e) + t) - vnoise(p + o3 - vec3(0.0, 0.0, e) + t);
  float z = vnoise(p + vec3(e, 0.0, 0.0) + t) - vnoise(p - vec3(e, 0.0, 0.0) + t);
  return normalize(vec3(x, y, z) + 1e-5);
}

// --- formations -----------------------------------------------------------
// All bounded to roughly the same volume so a morph never pops in scale.

/** Hero — the latent core: a dense shell wrapped in sparse haze. */
vec3 fCore(float i, vec3 h) {
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return d * (0.98 + h.x * h.x * 0.55);
}

/** Brojevi — the field measures itself into a precise lattice. */
vec3 fLattice(float i, vec3 h) {
  const float nx = 148.0, ny = 84.0;
  float x = mod(i, nx);
  float y = mod(floor(i / nx), ny);
  float z = floor(i / (nx * ny));
  return vec3((x / nx - 0.5) * 3.15, (y / ny - 0.5) * 1.75, (z / 21.0 - 0.5) * 1.0)
       + (h - 0.5) * 0.012;
}

/** Rezultati — a wide horizontal current, thinning toward the edges. */
vec3 fStream(float i, vec3 h) {
  float x = (h.x - 0.5) * 3.6;
  float env = 1.0 - x * x * 0.22;
  float y = (h.y - 0.5) * 0.62 * env + sin(x * 1.9) * 0.20 + sin(x * 4.3) * 0.05;
  return vec3(x, y, (h.z - 0.5) * 0.85 * env);
}

/** Paketi — three discrete modules. */
vec3 fClusters(float i, vec3 h) {
  float c = floor(h.x * 3.0);
  vec3 ctr = c < 1.0 ? vec3(-1.18, 0.16, 0.0)
           : c < 2.0 ? vec3(0.0, -0.26, 0.16)
                     : vec3(1.18, 0.20, -0.10);
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return ctr + d * (0.30 + h.y * h.y * 0.30);
}

/** Edukacija — a branching network. Twigs off each branch keep it from
 *  reading as bare spokes, and spread the particles so it is not 98% void. */
vec3 fNetwork(float i, vec3 h) {
  const float B = 11.0;
  float b = floor(h.x * B);
  float a = b * (6.2831853 / B) + 0.22 + 0.10 * sin(b * 3.1);
  float t = h.y;
  vec3 tip = vec3(cos(a) * 1.32, sin(a) * 1.02, sin(b * 2.35) * 0.50);
  vec3 mid = tip * 0.50 + vec3(0.0, 0.0, cos(b) * 0.14);
  vec3 p = t < 0.5 ? mix(vec3(0.0), mid, t * 2.0) : mix(mid, tip, (t - 0.5) * 2.0);
  vec3 off = normalize(vec3(-sin(a), cos(a), 0.35 * sin(b * 7.0)));
  p += off * max(h.z - 0.55, 0.0) * 1.5 * smoothstep(0.30, 1.0, t);
  return p + (h - 0.5) * (0.05 + t * 0.09);
}

/** Booking — everything resolves into one tight core, a few far outliers. */
vec3 fSingularity(float i, vec3 h) {
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return d * (0.34 + pow(h.x, 6.0) * 1.30);
}

vec3 formation(float i, vec3 h, int k) {
  if (k <= 0) return fCore(i, h);
  if (k == 1) return fLattice(i, h);
  if (k == 2) return fStream(i, h);
  if (k == 3) return fClusters(i, h);
  if (k == 4) return fNetwork(i, h);
  return fSingularity(i, h);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float i = float(c.y) * uDim.x + float(c.x);
  vec3 h = hash3(i * 0.0137 + 1.7);

  vec3 p = texelFetch(uPos, c, 0).xyz;
  vec3 v = texelFetch(uVel, c, 0).xyz;

  // Blend the two neighbouring formations.
  float s = clamp(uShape, 0.0, 5.0);
  int i0 = int(floor(s));
  int i1 = min(i0 + 1, 5);
  float fr = smoothstep(0.0, 1.0, fract(s));
  vec3 tgt = mix(formation(i, h, i0), formation(i, h, i1), fr);

  // One slow axis of rotation. Machined pace — never decorative.
  float a = uTime * 0.055;
  tgt.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * tgt.xz;

  // Fixed 12deg tilt. Every formation is mirror-symmetric about y=0 and the
  // camera looks straight down z, so without this the particle planes sit
  // exactly parallel to the pixel rows and alias into a hard seam across the
  // equator. The tilt also makes the forms read as solids rather than rings.
  const float TILT = 0.21;
  tgt.yz = mat2(cos(TILT), -sin(TILT), sin(TILT), cos(TILT)) * tgt.yz;

  // 1. Spring to target. This is what makes the field *resolve* rather than
  //    drift; stiffness rises as it settles so the arrival is crisp.
  vec3 f = (tgt - p) * (1.9 + uSettle * 2.6);

  // 2. Curl flow. Peaks mid-morph (fr*(1-fr)) and on scroll, ~0 at rest.
  float turb = uTurb + (1.0 - uSettle) * 0.55 + 4.0 * fr * (1.0 - fr);
  f += curl(p * 0.62, uTime * 0.10) * turb * 2.4;

  // 3. Cursor: soft radial push with a real falloff.
  vec2 d2 = p.xy - uPtr.xy;
  f.xy += normalize(d2 + 1e-5) * uPtr.z * 3.4 * exp(-dot(d2, d2) * 2.6);

  // 4. Click: an outward shockwave from the field centre.
  f += normalize(p + 1e-5) * uPulse * 4.2 * exp(-length(p) * 0.55);

  // Damping raised to dt so the feel is identical at 60 / 120 / 144 Hz and
  // after a tab-switch stall.
  v = v * pow(0.055, uDt) + f * uDt;
  p += v * uDt;

  oPos = vec4(p, 1.0);
  oVel = vec4(v, 0.0);
}
`;
}

// --- point render ----------------------------------------------------------
// No vertex buffers: gl.drawArrays(POINTS, 0, count) and the vertex shader
// fetches its own position by gl_VertexID.

export const pointVertexShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPos;
uniform sampler2D uVel;
uniform vec2  uDim;
uniform float uAspect;
uniform float uPxScale;
uniform vec2  uCenter;   // NDC offset — keeps the field clear of the copy
uniform float uScale;
uniform float uGain;     // particle-count compensation, see engine

out float vSpeed;
out float vDepth;
out float vGain;

const float CAM_Z = 3.15;
const float FOCAL = 1.45;

void main() {
  int id = gl_VertexID;
  ivec2 c = ivec2(id % int(uDim.x), id / int(uDim.x));
  vec3 p = texelFetch(uPos, c, 0).xyz * uScale;
  vec3 v = texelFetch(uVel, c, 0).xyz;

  vSpeed = length(v);
  vGain = uGain;
  float z = p.z + CAM_Z;
  float f = FOCAL / max(z, 0.25);   // perspective divide
  vDepth = f;

  gl_Position  = vec4(p.x * f / uAspect + uCenter.x, p.y * f + uCenter.y, 0.0, 1.0);
  gl_PointSize = clamp(uPxScale * f, 0.85, 4.5);
}
`;

export const pointFragmentShader = /* glsl */ `#version 300 es
precision highp float;

in float vSpeed;
in float vDepth;
in float vGain;
out vec4 outColor;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float mask = smoothstep(0.5, 0.06, length(d));

  // Motion is light. At rest the field is graphite; moving particles flare
  // white. The accent is ink in the calm areas only — never a glow source.
  float sp = clamp(vSpeed * 2.3, 0.0, 1.0);
  vec3 col = mix(vec3(0.46, 0.49, 0.58), vec3(1.0), sp * sp);
  col = mix(col, vec3(0.30, 0.46, 0.86), (1.0 - sp) * 0.30);

  // vDepth sits near 0.46 at rest; 1.55 restores a usable exposure. vGain
  // compensates for the reduced particle count on mobile — accumulation is
  // linear, so a quarter of the points needs four times the per-point light
  // to land on the same tonemap curve.
  float lum = (0.30 + sp * 0.85) * vDepth * 1.55 * vGain;
  outColor = vec4(col * lum * mask, 1.0);
}
`;

/** Exponential rolloff so dense formations stay bright *and* detailed. */
export const displayShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform vec2  uTexSize;
uniform float uTime;
uniform float uExposure;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec3 c = texture(uScene, uv).rgb;

  c = vec3(1.0) - exp(-c * uExposure);
  c += vec3(0.013, 0.013, 0.017);          // charcoal floor, not dead void

  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.30;             // barely-there vignette

  // Dither: without it the deep shadows band badly on 8-bit displays.
  float d = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 57.0,
                          vec2(12.9898, 78.233))) * 43758.5453);
  outColor = vec4(c + (d - 0.5) * (1.6 / 255.0), 1.0);
}
`;

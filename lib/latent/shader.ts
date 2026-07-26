// TOZAI latent field — a GPU particle system, not a fullscreen noise shader.
//
// Every particle is a point mass with velocity. Each section of the page has a
// FORMATION (a target position per particle); scroll interpolates between them.
// A particle springs toward its target, gets pushed around by a curl-noise
// flow, and is caught in a vortex around the cursor.
//
// The formations are defined in a STATIC frame and the camera orbits around
// them. Rotating the targets instead — as an earlier version did — means the
// particles are permanently chasing a moving goal and can never settle, which
// is what makes a point cloud read as mush. Settled points read as a shape.
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

uniform sampler2D uPos;     // xyz position, w brightness weight
uniform sampler2D uVel;     // xyz velocity
uniform vec2  uDim;         // particle texture dimensions
uniform mat3  uRot;         // orbit: simulation space -> view space
uniform float uTime;
uniform float uDt;
uniform float uShape;       // 0..5, fractional between formations
uniform float uTurb;        // transient turbulence (scroll / morph / click)
uniform float uSettle;      // 0..1, rises while the field is undisturbed
uniform float uPulse;       // 0..1 click shockwave, decays upstream
uniform vec3  uPtr;         // xy in VIEW units, z = cursor strength

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
// Each one has to own a DIFFERENT SILHOUETTE, otherwise every section reads as
// "a cloud of dots about one unit across" and the scroll story is invisible.
// So: a sphere, a flat plane, a long ribbon, three separated masses, a flat
// radial graph, and a single point.

/** Hero — the latent core: a dense shell around a bright nucleus. */
vec3 fCore(float i, vec3 h) {
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  // A fifth of the particles collapse inward as a nucleus — gives the sphere
  // an interior instead of reading as an empty soap bubble.
  if (h.z < 0.20) return d * (0.26 + h.x * 0.16);
  return d * (0.95 + h.x * h.x * 0.48);
}

/** Brojevi — a flat measured plane. Deliberately 2D: after a sphere, a plane
 *  is the most legible possible change of silhouette. */
vec3 fLattice(float i, vec3 h) {
  const float nx = 208.0, ny = 126.0;
  float x = mod(i, nx);
  float y = mod(floor(i / nx), ny);
  float layer = floor(i / (nx * ny));
  return vec3((x / nx - 0.5) * 3.30, (y / ny - 0.5) * 1.95, (layer - 4.0) * 0.035)
       + (h - 0.5) * 0.010;
}

/** Rezultati — a long horizontal ribbon with a travelling wave. */
vec3 fStream(float i, vec3 h) {
  float x = (h.x - 0.5) * 4.10;
  float env = 1.0 - x * x * 0.16;
  float y = (h.y - 0.5) * 0.34 * env + sin(x * 1.7) * 0.30 + sin(x * 3.9) * 0.07;
  return vec3(x, y, (h.z - 0.5) * 0.55 * env);
}

/** Paketi — three clearly separated masses. The gaps carry the meaning, so
 *  they are wide enough to survive the perspective divide. */
vec3 fClusters(float i, vec3 h) {
  float c = floor(h.x * 3.0);
  vec3 ctr = c < 1.0 ? vec3(-1.42, 0.20, 0.05)
           : c < 2.0 ? vec3(0.0, -0.30, 0.18)
                     : vec3(1.42, 0.24, -0.12);
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return ctr + d * (0.20 + h.y * h.y * 0.26);
}

/** Edukacija — a radial graph held near one plane so the branches read as
 *  connections rather than as a second sphere. */
vec3 fNetwork(float i, vec3 h) {
  const float B = 14.0;
  float b = floor(h.x * B);
  float a = b * (6.2831853 / B) + 0.22 + 0.10 * sin(b * 3.1);
  // sqrt, not uniform: the branches converge, so spacing particles evenly
  // along t piles them up near the centre where the cross-section is smallest
  // and burns a hole through the middle. Area-weighting pushes them outward.
  float t = sqrt(h.y);
  vec3 tip = vec3(cos(a) * 1.55, sin(a) * 1.20, sin(b * 2.35) * 0.18);
  vec3 mid = tip * 0.48 + vec3(0.0, 0.0, cos(b) * 0.06);
  // Branches start on a small hub, not at a shared point: converging every
  // branch on the origin stacks the whole graph's density into a few pixels
  // and burns a white hole through the middle of the form.
  vec3 hub = normalize(vec3(cos(a), sin(a), 0.25 * sin(b * 5.0))) * 0.18;
  vec3 p = t < 0.5 ? mix(hub, mid, t * 2.0) : mix(mid, tip, (t - 0.5) * 2.0);
  // Independent jitter: h is already spent on branch, position and tip, so
  // reusing it correlates the scatter with the structure and stripes appear.
  vec3 j = hash3(i * 1.37 + 5.1) - 0.5;
  // Tip clusters: the graph needs visible nodes or it is just spokes. Keep the
  // share small and the spread wide — dense knots blow out the tonemap.
  if (h.z > 0.90) return tip + j * 0.58;
  // Branches taper outward, so they read as limbs and the density along each
  // line stays under the tonemap's knee.
  return p + j * vec3(0.13 + t * 0.15, 0.13 + t * 0.15, 0.05);
}

/** Booking — everything resolves into one tight core, a few far outliers. */
vec3 fSingularity(float i, vec3 h) {
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = PHI * i;
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return d * (0.40 + pow(h.x, 7.0) * 1.45);
}

vec3 formation(float i, vec3 h, int k) {
  if (k <= 0) return fCore(i, h);
  if (k == 1) return fLattice(i, h);
  if (k == 2) return fStream(i, h);
  if (k == 3) return fClusters(i, h);
  if (k == 4) return fNetwork(i, h);
  return fSingularity(i, h);
}

/** Per-formation brightness weight. Picking out nuclei, cluster cores and
 *  branch tips is what turns an even dust cloud into a legible structure. */
float nodeWeight(vec3 h, int k) {
  if (k == 0) return h.z < 0.20 ? 2.1 : 0.85;      // nucleus
  if (k == 1) return 0.72 + step(0.94, h.z) * 1.5; // lattice accents
  if (k == 3) return 0.80 + step(0.88, h.y) * 1.5; // cluster cores
  if (k == 4) return h.z > 0.90 ? 1.45 : 0.72;     // branch tips
  if (k == 5) return h.x < 0.35 ? 1.30 : 0.72;     // the core itself
  return 1.0;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float i = float(c.y) * uDim.x + float(c.x);
  vec3 h = hash3(i * 0.0137 + 1.7);

  vec3 p = texelFetch(uPos, c, 0).xyz;
  vec3 v = texelFetch(uVel, c, 0).xyz;

  float s = clamp(uShape, 0.0, 5.0);
  int i0 = int(floor(s));
  int i1 = min(i0 + 1, 5);
  float fr = smoothstep(0.0, 1.0, fract(s));

  vec3 t0 = formation(i, h, i0);
  vec3 t1 = formation(i, h, i1);

  // Staggered assembly. A straight cross-fade moves every particle at once,
  // which looks like a dissolve; delaying each one by a left-to-right sweep
  // plus a little noise makes the next form visibly BUILD.
  float delay = clamp(t0.x * 0.26 + 0.5, 0.0, 1.0);
  delay = mix(delay, h.z, 0.45);
  float frp = smoothstep(0.0, 1.0, clamp((fr - delay * 0.55) / 0.45, 0.0, 1.0));

  vec3 tgt = mix(t0, t1, frp);

  // Fixed 12deg tilt. Every formation is mirror-symmetric about y=0 and the
  // camera looks straight down z, so without this the particle planes sit
  // exactly parallel to the pixel rows and alias into a hard seam across the
  // equator. The tilt also makes the forms read as solids rather than rings.
  const float TILT = 0.21;
  tgt.yz = mat2(cos(TILT), -sin(TILT), sin(TILT), cos(TILT)) * tgt.yz;

  // 1. Spring to target. Stiffness rises as the field settles so the arrival
  //    is crisp rather than soggy.
  vec3 f = (tgt - p) * (2.4 + uSettle * 3.4);

  // 2. Curl flow. Peaks mid-morph, plus a permanent trace so a settled field
  //    still shimmers instead of freezing into a dead diagram.
  float turb = uTurb + 4.0 * fr * (1.0 - fr) + 0.035;
  f += curl(p * 0.62, uTime * 0.10) * turb * 2.4;

  // 3. Cursor vortex, in VIEW space — the user aims at what they can see, and
  //    the formations live in a frame the camera orbits around. Tangential
  //    force dominates the radial one, so the field swirls rather than just
  //    denting, then the spring reels it back in.
  vec3 pv = uRot * p;
  vec2 d2 = pv.xy - uPtr.xy;
  float fall = exp(-dot(d2, d2) * 2.4);
  vec2 dir = normalize(d2 + 1e-5);
  vec2 swirl = vec2(-dir.y, dir.x);
  vec3 fView = vec3((dir * 1.15 + swirl * 2.05) * uPtr.z * 3.2 * fall, 0.0);
  f += transpose(uRot) * fView;

  // 4. Click: an outward shockwave from the field centre.
  f += normalize(p + 1e-5) * uPulse * 4.2 * exp(-length(p) * 0.55);

  // Damping raised to dt so the feel is identical at 60 / 120 / 144 Hz and
  // after a tab-switch stall.
  v = v * pow(0.055, uDt) + f * uDt;
  p += v * uDt;

  float node = mix(nodeWeight(h, i0), nodeWeight(h, i1), frp);
  oPos = vec4(p, node);
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
uniform mat3  uRot;      // orbit: simulation space -> view space
uniform float uAspect;
uniform float uPxScale;
uniform vec2  uCenter;   // NDC offset — keeps the field clear of the copy
uniform float uScale;
uniform float uGain;     // particle-count compensation, see engine

out float vSpeed;
out float vFade;
out float vNode;
out float vGain;
out vec2  vDir;          // screen-space velocity direction
out float vStretch;      // motion-blur elongation along vDir

const float CAM_Z = 3.15;
const float FOCAL = 1.45;

void main() {
  int id = gl_VertexID;
  ivec2 c = ivec2(id % int(uDim.x), id / int(uDim.x));
  vec4 pr = texelFetch(uPos, c, 0);
  vec3 p = uRot * (pr.xyz * uScale);
  vec3 v = uRot * texelFetch(uVel, c, 0).xyz;

  vNode = pr.w;
  vGain = uGain;
  vSpeed = length(v);

  float z = p.z + CAM_Z;
  float f = FOCAL / max(z, 0.25);   // perspective divide

  // Depth cue. Without it every particle is equally bright and the cloud
  // reads flat; fading the far side is what makes the form look solid.
  vFade = clamp(1.0 - (z - CAM_Z) * 0.42, 0.18, 1.55);

  // Motion blur: stretch the sprite along its screen-space velocity. This is
  // what sells the transitions — particles become streaks in flight and snap
  // back to points on arrival.
  vec2 sv = vec2(v.x / uAspect, v.y) * f;
  float svl = length(sv);
  vDir = svl > 1e-4 ? sv / svl : vec2(1.0, 0.0);
  vStretch = 1.0 + min(svl * 26.0, 3.2);

  gl_Position  = vec4(p.x * f / uAspect + uCenter.x, p.y * f + uCenter.y, 0.0, 1.0);
  gl_PointSize = clamp(uPxScale * f * (0.75 + vNode * 0.35) * vStretch, 0.85, 11.0);
}
`;

export const pointFragmentShader = /* glsl */ `#version 300 es
precision highp float;

in float vSpeed;
in float vFade;
in float vNode;
in float vGain;
in vec2  vDir;
in float vStretch;
out vec4 outColor;

void main() {
  // Work in the sprite's velocity frame so the falloff can be elongated along
  // the direction of travel — a round mask here would just make fast
  // particles fat instead of streaked.
  vec2 c = gl_PointCoord - 0.5;
  vec2 a = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x)));
  a.x /= vStretch;
  float mask = smoothstep(0.5, 0.04, length(a));

  // Motion is light. At rest the field is graphite; moving particles flare
  // white. The accent is ink in the calm areas only — never a glow source.
  float sp = clamp(vSpeed * 2.3, 0.0, 1.0);
  vec3 col = mix(vec3(0.46, 0.49, 0.58), vec3(1.0), sp * sp);
  col = mix(col, vec3(0.30, 0.46, 0.86), (1.0 - sp) * 0.30);

  // A settled form has to be the BRIGHTEST thing on screen, not the dimmest,
  // or the shape is only legible while it is moving. Hence the high base.
  // vGain compensates for the reduced particle count on mobile: accumulation
  // is linear, so a quarter of the points needs four times the light.
  float lum = (0.52 + sp * 0.80) * vNode * vFade * 0.92 * vGain;

  // Energy is conserved as the sprite stretches, so streaks thin out instead
  // of turning into bright smears.
  lum /= vStretch;

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

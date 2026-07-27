// TOZA AI latent field — a GPU particle system, not a fullscreen noise shader.
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
// Five passes per frame:
//   1. sim     — MRT into (position, velocity) float textures, ping-ponged
//   2. points  — additive gl.POINTS into an HDR buffer, read via texelFetch
//   3. bright  — threshold the HDR buffer down to quarter res
//   4. blur    — separable gaussian, two ping-ponged directions
//   5. display — filmic tonemap + grade to the screen
//
// The tonemap is not decoration: additive accumulation is unbounded, so dense
// formations clip to flat white without it.
//
// LIGHTING. The particles are not emissive. A three-point studio rig lives in
// VIEW space — key, fill and rim stay put while the camera orbits, exactly like
// lamps around a turntable — and the field is shaded against it. That is the
// whole difference between "glittering dust" and "a photographed object": a
// particle's brightness is a function of WHERE IT IS on the form, not of how
// fast it happens to be moving. The bloom pass then lets only genuinely hot
// regions bleed, instead of every point glowing equally.

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
uniform sampler2D uWord;    // per-particle wordmark target, xyz
uniform float uBoot;        // 0..1 first-load ramp: chaos resolving into form
uniform vec4  uCopy;        // copy column in VIEW units: (minX, minY, maxX, maxY)
uniform float uCopyAmt;     // how hard the field is pushed clear of the copy

layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;

const float N   = ${count}.0;

/** Golden-angle azimuth for particle i.
 *
 *  Written the obvious way — PHI * i — the argument reaches six hundred
 *  thousand radians at the far end of the field, and a 24-bit mantissa cannot
 *  resolve an angle that far out: consecutive particles quantise onto the same
 *  few azimuths and the Fibonacci spiral collapses into hard spokes lying
 *  across the form. Multiplying by 1/phi in uint32 wraps EXACTLY, so the
 *  sequence stays equidistributed for every index. */
float spiralAngle(float i) {
  return 6.2831853 * (float(uint(i) * 2654435769u) * (1.0 / 4294967296.0));
}

// PCG3D, not fract(sin(...)). The particle index runs to a quarter of a
// million, and sin() of an argument that large has so little mantissa left in
// mediump/highp float that consecutive indices collapse onto the same hash.
// Those runs of identical hashes place runs of particles at the same target,
// which the motion blur then draws as hard horizontal lines across the form.
// Salted by particle index, never by a scaled float: an argument like
// i * 0.0137 advances by well under one unit per index, so rounding it to an
// integer seed makes neighbouring particles share a hash and the "random"
// spread collapses onto a curve.
vec3 hash3(float i, uint salt) {
  uint s = uint(max(i, 0.0)) * 747796405u + salt * 2891336453u;
  uvec3 v = uvec3(s + 19u, s * 2654435761u + 7u, s * 40503u + 131u);
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec3(v) * (1.0 / 4294967296.0);
}

/** Value noise over an integer-hashed lattice.
 *
 *  The textbook fract(sin(dot(...))) version degenerates: it collapses to zero
 *  wherever its argument does, and neighbouring lattice nodes stay correlated
 *  because they differ by small integers. In a curl field that shows up as a
 *  whole lattice CELL sharing one flow direction, which sweeps every particle
 *  out of it and punches a hard axis-aligned black box through the formation —
 *  and since the noise domain drifts with time, the box wanders. */
float vhash(ivec3 c) {
  uint n = uint(c.x) * 374761393u + uint(c.y) * 668265263u + uint(c.z) * 1274126177u;
  n = (n ^ (n >> 13u)) * 1274126177u;
  n ^= n >> 16u;
  return float(n) * (1.0 / 4294967296.0);
}

float vnoise(vec3 p) {
  vec3 fp = floor(p);
  ivec3 c = ivec3(fp);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 a = vec4(vhash(c), vhash(c + ivec3(1, 0, 0)),
                vhash(c + ivec3(0, 1, 0)), vhash(c + ivec3(1, 1, 0)));
  vec4 b = vec4(vhash(c + ivec3(0, 0, 1)), vhash(c + ivec3(1, 0, 1)),
                vhash(c + ivec3(0, 1, 1)), vhash(c + ivec3(1, 1, 1)));
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
  float th = spiralAngle(i);
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  // A fifth of the particles collapse inward as a nucleus — gives the sphere
  // an interior instead of reading as an empty soap bubble. The radius is wide
  // on purpose: packed any tighter, the nucleus accumulates so far past the
  // tonemap's shoulder that it clips to a flat white disc at every usable
  // exposure, and a clipped disc cannot show the studio rig's shading.
  if (h.z < 0.20) return d * (0.30 + h.x * 0.34);
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
  float th = spiralAngle(i);
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
  vec3 j = hash3(i, 7u) - 0.5;
  // Tip clusters: the graph needs visible nodes or it is just spokes. Keep the
  // share small and the spread wide — dense knots blow out the tonemap.
  if (h.z > 0.90) return tip + j * 0.58;
  // Branches taper outward, so they read as limbs and the density along each
  // line stays under the tonemap's knee.
  return p + j * vec3(0.13 + t * 0.15, 0.13 + t * 0.15, 0.05);
}

/** Booking — everything resolves into one core, a few far outliers. The core
 *  is a shell with a soft interior rather than a solid ball: piling two thirds
 *  of the field inside one small radius clips to a featureless white dot. */
vec3 fSingularity(float i, vec3 h) {
  float k = (i + 0.5) / N;
  float phi = acos(clamp(1.0 - 2.0 * k, -1.0, 1.0));
  float th = spiralAngle(i);
  vec3 d = vec3(sin(phi) * cos(th), sin(phi) * sin(th), cos(phi));
  return d * (0.34 + pow(h.x, 2.2) * 0.34 + pow(h.x, 9.0) * 1.30);
}

/** Index 6 is not procedural: its targets are rasterised from the TOZA AI
 *  wordmark on the CPU and uploaded as a texture, one texel per particle. */
vec3 formation(float i, vec3 h, int k) {
  if (k <= 0) return fCore(i, h);
  if (k == 1) return fLattice(i, h);
  if (k == 2) return fStream(i, h);
  if (k == 3) return fClusters(i, h);
  if (k == 4) return fNetwork(i, h);
  return fSingularity(i, h);
}

/** Per-formation brightness weight. Picking out nuclei, cluster cores and
 *  branch tips is what turns an even dust cloud into a legible structure.
 *
 *  The range is deliberately narrow — narrower still since the accents were the
 *  source of the cheap-sparkle read. Accumulation is additive, so a weight of 2
 *  in an already dense region does not read as "twice as bright" — it reads as
 *  clipped white, and every gradient the lighting put there is lost. Worse, a
 *  hot accent scattered at random through the form is exactly what glitter is:
 *  brightness uncorrelated with the shape. Tone is the rig's job; these weights
 *  only bias it, and they now bias it gently. */
float nodeWeight(vec3 h, int k) {
  if (k == 0) return h.z < 0.20 ? 1.10 : 0.90;      // nucleus
  if (k == 1) return 0.80 + step(0.94, h.z) * 0.40; // lattice accents
  if (k == 3) return 0.86 + step(0.88, h.y) * 0.40; // cluster cores
  if (k == 4) return h.z > 0.90 ? 1.12 : 0.80;      // branch tips
  if (k == 5) return h.x < 0.35 ? 1.08 : 0.80;      // the core itself
  return 1.0;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float i = float(c.y) * uDim.x + float(c.x);
  vec3 h = hash3(i, 0u);

  vec3 p = texelFetch(uPos, c, 0).xyz;
  vec3 v = texelFetch(uVel, c, 0).xyz;

  float s = clamp(uShape, 0.0, 6.0);
  int i0 = int(floor(s));
  int i1 = min(i0 + 1, 6);
  float fr = smoothstep(0.0, 1.0, fract(s));

  vec3 word = texelFetch(uWord, c, 0).xyz;
  vec3 t0 = i0 >= 6 ? word : formation(i, h, i0);
  vec3 t1 = i1 >= 6 ? word : formation(i, h, i1);

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
  //
  // Released as the wordmark arrives: letterforms are only legible face-on, so
  // the finale trades the anti-aliasing tilt for readability.
  float tilt = 0.21 * (1.0 - smoothstep(5.15, 6.0, s));
  tgt.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * tgt.yz;

  // 1. Spring to target. Stiffness rises as the field settles so the arrival
  //    is crisp rather than soggy. On first load the spring is near zero and
  //    ramps in, so the page opens on latent chaos that visibly RESOLVES as
  //    the preloader lifts, rather than on an already-finished picture.
  vec3 f = (tgt - p) * (2.7 + uSettle * 4.1) * (0.04 + 0.96 * uBoot);

  // 2. Curl flow. Peaks mid-morph, plus a permanent trace so a settled field
  //    breathes instead of freezing into a dead diagram. The boot ramp adds the
  //    initial churn.
  //
  //    That trace used to be nearly twice this. A settled form whose particles
  //    keep wandering is a form whose every particle keeps crossing the
  //    specular and bloom thresholds — which is the shimmer that made the whole
  //    thing read as cheap. Stillness is what costs money: expensive lighting
  //    needs something that holds still long enough to be lit.
  float turb = uTurb + 4.0 * fr * (1.0 - fr) + 0.018 + (1.0 - uBoot) * 1.35;
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

  // 5. Keep clear of the copy. The text column is fed in as a box in view
  //    space and the field is pushed out of it, so the type never has to fight
  //    the particles for legibility and the field looks like it is making room
  //    rather than sitting behind the words. Soft-edged: a hard boundary would
  //    read as a rectangular hole punched in the cloud.
  if (uCopyAmt > 0.001) {
    vec2 mid = (uCopy.xy + uCopy.zw) * 0.5;
    vec2 ext = (uCopy.zw - uCopy.xy) * 0.5;
    vec2 q = abs(pv.xy - mid) - ext;
    // Signed distance to the box: positive outside, negative within.
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    // Tight falloff and a gentle force. The spring is ~5.8, so anything
    // stronger than this stops nudging the field and starts bulldozing it into
    // a pile beside the text.
    float push = smoothstep(0.22, -0.06, sd) * uCopyAmt;
    if (push > 0.001) {
      f += transpose(uRot) * vec3(normalize(pv.xy - mid + 1e-5) * push * 2.2, 0.0);
    }
  }

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
uniform float uCamZ;     // dolly distance — each section is framed from its own
uniform float uFocus;    // focal plane, in the same view depth as z
uniform float uCoc;      // circle-of-confusion strength; 0 = everything sharp

out float vSpeed;
out float vFade;
out float vNode;
out float vGain;
out vec2  vDir;          // screen-space velocity direction
out float vStretch;      // motion-blur elongation along vDir
out vec3  vNormal;       // form-scale shading normal, view space
out float vCoc;          // defocus radius, in sprite widths
out float vSweep;        // diagonal coordinate for the transition light cut

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

  // Form-scale normal: the direction out of the field's centre, in view space.
  // On the shell formations this IS the surface normal. On the flat ones it
  // degenerates into a smooth directional ramp across the plane — which is
  // what a key light does to a flat card anyway. Either way the rig gets a
  // coherent, POSITION-CORRELATED quantity to shade with, and that is what
  // makes the light read as light instead of as per-particle noise.
  //
  // Near the origin the direction is undefined and would turn into per-particle
  // hash — a bright speckle right through the middle of every dense formation.
  // So the innermost particles are faced at the camera and the true direction
  // fades in with radius.
  float pl = length(p);
  vNormal = normalize(mix(vec3(0.0, 0.0, 1.0), p / max(pl, 1e-4),
                          smoothstep(0.05, 0.34, pl)));

  float z = p.z + uCamZ;
  float f = FOCAL / max(z, 0.25);   // perspective divide

  // Depth cue. Without it every particle is equally bright and the cloud
  // reads flat; fading the far side is what makes the form look solid.
  vFade = clamp(1.0 - (z - uCamZ) * 0.42, 0.18, 1.55);

  // Motion blur: stretch the sprite along its screen-space velocity. This is
  // what sells the transitions — particles become streaks in flight and snap
  // back to points on arrival.
  // Depth of field. A shallow focal plane is the single strongest photographic
  // cue available here: the near and far dust melts into bokeh and only the
  // band the camera is focused on stays crisp, so the eye is told where to
  // look. The sprite grows with the defocus radius and the fragment shader
  // divides the light back out, so blurring never adds energy.
  vCoc = min(abs(z - uFocus) * uCoc, 1.35);
  vSweep = dot(p.xy, normalize(vec2(0.78, 0.62)));

  vec2 sv = vec2(v.x / uAspect, v.y) * f;
  float svl = length(sv);
  vDir = svl > 1e-4 ? sv / svl : vec2(1.0, 0.0);
  // Streaking is suppressed out of focus: a defocused particle is already a
  // soft disc, and stretching it as well draws a long hard smear that reads as
  // a scratch on the frame rather than as movement.
  vStretch = 1.0 + min(svl * 26.0, 3.2) / (1.0 + vCoc * 1.6);

  gl_Position  = vec4(p.x * f / uAspect + uCenter.x, p.y * f + uCenter.y, 0.0, 1.0);
  gl_PointSize = clamp(
    uPxScale * f * (0.75 + vNode * 0.35) * vStretch * (1.0 + vCoc * 1.9),
    0.85, 26.0);
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
in vec3  vNormal;
in float vCoc;
in float vSweep;
uniform float uTransitionPhase; // -1 inactive, otherwise 0..1 over 220ms
out vec4 outColor;

// The rig. Fixed in VIEW space: the lamps stand still and the subject turns on
// the table, so the key sweeps across the form as the camera orbits. Anchoring
// them to the field instead would rotate the lighting with the object, which
// reads as a flat unlit texture no matter how good the falloff is.
const vec3 KEY_DIR  = normalize(vec3(-0.58,  0.66,  0.48));   // upper left, front
const vec3 FILL_DIR = normalize(vec3( 0.74, -0.30,  0.36));   // lower right, weak
const vec3 RIM_DIR  = normalize(vec3( 0.22,  0.52, -0.82));   // above and behind
const vec3 KEY_COL  = vec3(1.00, 0.965, 0.915);               // tungsten-warm
const vec3 FILL_COL = vec3(0.42, 0.56, 0.92);                 // cool bounce
const vec3 RIM_COL  = vec3(0.66, 0.80, 1.00);
const vec3 ALBEDO   = vec3(0.20, 0.225, 0.30);                // dark graphite pearl
const vec3 VIEW_DIR = vec3(0.0, 0.0, 1.0);
// Aerial perspective: the far side of the volume cools and loses contrast, the
// way any depth of real atmosphere does. Free, and it is half of why a
// photographed object looks like it occupies space.
const vec3 DEPTH_COL = vec3(0.62, 0.74, 1.00);

void main() {
  // Work in the sprite's velocity frame so the falloff can be elongated along
  // the direction of travel — a round mask here would just make fast
  // particles fat instead of streaked.
  vec2 c = gl_PointCoord - 0.5;
  vec2 a = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x)));
  a.x /= vStretch;

  // Focused particles keep a precise bead edge; defocus adds a controlled
  // feather instead of expanding the point into an anonymous light blob.
  float feather = mix(0.07, 0.25, clamp(vCoc, 0.0, 1.0));
  float mask = 1.0 - smoothstep(0.5 - feather, 0.5, length(a));

  // Sphere imposter: treat the sprite as a tiny bead and reconstruct its
  // normal from the sprite coordinate. Costs three instructions and turns flat
  // discs into lit spheres, which is where the specular glints come from.
  vec2 nxy = a * 2.0;
  vec3 nBead = vec3(nxy, sqrt(max(0.0, 1.0 - min(dot(nxy, nxy), 1.0))));

  vec3 n = vNormal;
  // Wrapped diffuse. A hard Lambert terminator aliases badly across a point
  // cloud — half the form would simply vanish — so the falloff wraps around
  // and the unlit side keeps just enough presence to read as mass.
  float key  = pow(dot(n, KEY_DIR)  * 0.5 + 0.5, 2.15);
  float fill = pow(dot(n, FILL_DIR) * 0.5 + 0.5, 2.8);
  // Rim: brightest where the form normal turns away from the camera, i.e. at
  // the silhouette. This is what separates the object from the background and
  // is the most recognisable studio move there is.
  float rim  = pow(1.0 - abs(dot(n, VIEW_DIR)), 4.2) * max(dot(n, RIM_DIR), 0.0);

  // Ambient dropped hard. A lifted floor is what makes a dark render look
  // cheap: it greys out the unlit side so the key has nothing to be brighter
  // THAN, and every particle ends up carrying roughly the same level — which is
  // the flat, twinkly look. Let the shadow side go almost to black and the key
  // does the describing.
  vec3 lit = ALBEDO * (0.022 + KEY_COL * key * 0.92 + FILL_COL * fill * 0.14)
           + RIM_COL * rim * 1.08;

  // Specular on the bead — but gated TWICE, and that second gate is the whole
  // fix for "why does this glitter".
  //
  // The bead normal is reconstructed per sprite pixel, so on its own the
  // highlight fires wherever a particle's own little sphere happens to face the
  // key. Across a quarter of a million independently drifting particles that is
  // a field of random blinks, i.e. tinsel. Gating it on the FORM normal as well
  // confines the whole set of highlights to the one patch of the volume that
  // genuinely faces the light: a single coherent sheen that travels across the
  // shape as the camera orbits. Same instruction count, completely different
  // read — polished metal instead of Christmas lights.
  vec3 h = normalize(KEY_DIR + VIEW_DIR);
  float sheen = pow(max(dot(n, h), 0.0), 18.0);
  float bead = 0.72 + pow(max(dot(nBead, VIEW_DIR), 0.0), 28.0) * 0.28;
  float spec = sheen * bead * smoothstep(0.92, 1.1, vNode);
  lit += KEY_COL * spec * 0.78;

  // A scene change gets one narrow, time-based light cut. It is rim-gated so
  // it describes the surface instead of flashing the entire formation.
  if (uTransitionPhase >= 0.0) {
    float sweepCenter = mix(-2.2, 2.2, uTransitionPhase);
    float band = exp(-pow((vSweep - sweepCenter) * 5.8, 2.0))
               * sin(uTransitionPhase * 3.14159265);
    lit += mix(RIM_COL, KEY_COL, 0.38) * band * (0.16 + rim * 0.84) * 0.42;
  }

  // Motion is TEMPERATURE, not a flashbulb. Driving brightness at white with
  // speed is exactly the cheap sparkle: a blink uncorrelated with the form. So
  // speed warms the particle and adds only a trace of light, enough that a
  // streak still reads in flight and nothing more.
  float sp = clamp(vSpeed * 2.3, 0.0, 1.0);
  lit = mix(lit, lit * vec3(1.10, 1.02, 0.92), sp);
  lit += vec3(1.0, 0.97, 0.93) * sp * sp * 0.06;

  // Aerial perspective. vFade already dims with depth; this also cools and
  // flattens the far side, so the volume separates front-to-back instead of
  // reading as one sheet of dust at varying brightness.
  float near = clamp(vFade, 0.0, 1.0);
  lit = mix(lit * DEPTH_COL * 0.72, lit, near);

  // vGain uses sublinear compensation on reduced profiles so mobile retains
  // presence without matching desktop's total additive energy.
  float lum = (0.52 + sp * 0.06) * vNode * vFade * vGain;

  // Energy is conserved as the sprite stretches, so streaks thin out instead
  // of turning into bright smears — and likewise as it defocuses, so a bokeh
  // disc carries the same total light as the dot it came from.
  float spread = 1.0 + vCoc * 1.9;
  lum /= vStretch * spread * spread;

  outColor = vec4(lit * lum * mask, 1.0);
}
`;

/**
 * Bright pass — quarter-res threshold with a soft knee.
 *
 * This is the pass that fixes "everything sparkles". Bloom applied to the whole
 * frame makes every particle glow equally, which is glitter; thresholding first
 * means only the genuinely hot regions bleed, so the form gets hot cores and
 * clean, dark edges. Exposure is applied HERE too so the threshold is measured
 * against the same values the display shader will tonemap.
 */
export const brightPassShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform vec2  uTexSize;   // this target's dimensions
uniform vec2  uSrcTexel;  // 1 / source dimensions
uniform float uExposure;
uniform float uThreshold;
uniform float uKnee;

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  // Four-tap box downsample. A single bilinear tap at quarter res skips three
  // quarters of the pixels, and the ones it skips are individual particles —
  // the bloom would crawl as the field moves.
  vec3 c = (texture(uScene, uv + uSrcTexel * vec2(-1.0, -1.0)).rgb
          + texture(uScene, uv + uSrcTexel * vec2( 1.0, -1.0)).rgb
          + texture(uScene, uv + uSrcTexel * vec2(-1.0,  1.0)).rgb
          + texture(uScene, uv + uSrcTexel * vec2( 1.0,  1.0)).rgb) * 0.25 * uExposure;

  float l = max(max(c.r, c.g), c.b);
  // Quadratic knee: highlights ease into the bloom instead of popping on at a
  // hard cutoff, which would shimmer as particles cross the threshold.
  float s = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  s = s * s / (4.0 * uKnee + 1e-5);
  outColor = vec4(c * (max(s, l - uThreshold) / max(l, 1e-4)), 1.0);
}
`;

/** Separable gaussian, nine taps folded into five linear ones.
 *
 *  uRadius scales the tap spacing so the same program can be run twice per axis
 *  at different widths. Two octaves of blur is what turns a bloom into
 *  HALATION: a tight core glow plus a wide, very soft bleed. A single narrow
 *  pass gives every bright particle its own small halo — which is glitter with
 *  extra steps — while a wide bleed pools light across the whole form and reads
 *  as an actual light source in the room. */
export const blurShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uTexSize;
uniform vec2 uDir;        // (1,0) or (0,1), in texels
uniform float uRadius;    // tap spacing multiplier

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec2 t = uDir * uRadius / uTexSize;
  vec3 c = texture(uSrc, uv).rgb * 0.227027;
  c += (texture(uSrc, uv + t * 1.3846154).rgb + texture(uSrc, uv - t * 1.3846154).rgb) * 0.3162162;
  c += (texture(uSrc, uv + t * 3.2307692).rgb + texture(uSrc, uv - t * 3.2307692).rgb) * 0.0702703;
  outColor = vec4(c, 1.0);
}
`;

/**
 * Filmic tonemap and grade.
 *
 * The old exponential rolloff pushed every highlight straight at pure white,
 * which desaturates the rig's warm key into the same flat glare as everything
 * else. The ACES curve keeps hue through the shoulder, so a bright warm
 * particle stays warm. Everything after it — split tone, vignette, aberration,
 * grain — is the grade a colourist would put on a studio plate.
 */
export const displayShader = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2  uTexSize;
uniform float uTime;
uniform float uExposure;
uniform float uBloomAmt;
uniform float uCA;        // chromatic aberration, in uv at the corners
uniform float uGrain;

out vec4 outColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uTexSize;
  vec2 q = uv - 0.5;
  float r2 = dot(q, q);

  // Lateral chromatic aberration: real glass separates colour toward the
  // corners and leaves the centre clean, so the offset rides r^2. Roughly one
  // pixel at the corners — enough to soften the edge of the frame, far short
  // of a visible rainbow.
  vec2 off = q * r2 * uCA;
  vec3 c = vec3(
    texture(uScene, uv + off).r,
    texture(uScene, uv).g,
    texture(uScene, uv - off).b);

  // Bloom is sampled at a slight offset from the scene's own aberration so the
  // halation is not a perfectly registered copy of the highlights; real glass
  // never lines them up exactly.
  // Compress dense additive accumulation before bloom is added. This keeps a
  // packed formation graphite-grey instead of mapping its whole interior to
  // white, while the sparse rim/specular bloom can still sit above the body.
  c *= uExposure;
  float sceneLum = dot(c, LUMA);
  c *= 1.0 / (1.0 + sceneLum * 1.5);
  c += texture(uBloom, uv + off * 0.5).rgb * uBloomAmt;

  // No anamorphic streak here on purpose. Wide horizontal taps of a
  // quarter-res bloom buffer ghost into visible horizontal lines across the
  // form rather than blending into a flare — a real one needs its own blurred
  // chain, and the artefact reads as a glitch, which is the opposite of the
  // intent.

  // Split tone in LINEAR, before the curve. Grading after the tonemap fights
  // the shoulder — the multiplier pushes already-clamped highlights back over
  // 1.0 and they clip a second time. Cool shadows, warm highlights, small
  // numbers: the point is that the neutrals stop being neutral, not that the
  // frame turns teal-and-orange.
  float lin = dot(c, LUMA);
  c *= mix(vec3(0.88, 0.94, 1.08), vec3(1.05, 1.00, 0.94), smoothstep(0.0, 0.55, lin));

  c = aces(c);

  // Contrast, applied after the curve where it behaves like a print grade
  // rather than like exposure. A soft S around the mids is the single cheapest
  // way to stop a dark scene reading as a grey haze with sparkles in it: the
  // shadows commit to black, so the lit side has somewhere to be bright from.
  c = clamp((c - 0.5) * 1.16 + 0.5 - 0.028, 0.0, 1.0);

  float luma = dot(c, LUMA);
  c += vec3(0.008, 0.010, 0.019) * (1.0 - luma);   // charcoal floor, not dead void

  // Vignette, elliptical and shaped rather than the old flat quadratic: it
  // holds the centre open and falls away hard in the corners, which is what
  // pulls the eye onto the subject.
  vec2 e = q * vec2(1.06, 1.24);
  c *= mix(0.36, 1.0, pow(clamp(1.0 - dot(e, e) * 1.15, 0.0, 1.0), 1.45));

  // Film grain: strongest in the mids, backing off in the blacks and the
  // speculars, the way real stock behaves.
  float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 141.0,
                          vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += g * uGrain * (0.35 + 0.65 * (1.0 - abs(luma * 2.0 - 1.0)));

  // Dither: without it the deep shadows band badly on 8-bit displays.
  float d = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 57.0,
                          vec2(21.7311, 43.129))) * 24634.6345);
  outColor = vec4(c + (d - 0.5) * (1.6 / 255.0), 1.0);
}
`;

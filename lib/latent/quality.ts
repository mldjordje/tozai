export interface LatentProfileInput {
  viewportWidth: number;
  viewportHeight: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
}

export interface LatentProfile {
  name: "high" | "balanced" | "efficient" | "minimal";
  texDim: number;
  maxDpr: number;
  maxRenderPixels: number;
  /** Where this profile enters the runtime performance ladder (see PERF_STEPS). */
  startStep: number;
}

export interface SafeCanvasInput {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  maxDpr: number;
  maxTextureSize: number;
  maxRenderPixels: number;
}

const PROFILES: Record<LatentProfile["name"], LatentProfile> = {
  high: {
    name: "high",
    texDim: 512,
    maxDpr: 1.5,
    maxRenderPixels: 5_000_000,
    startStep: 0,
  },
  balanced: {
    name: "balanced",
    texDim: 384,
    maxDpr: 1.25,
    maxRenderPixels: 3_200_000,
    startStep: 1,
  },
  efficient: {
    name: "efficient",
    texDim: 256,
    maxDpr: 1,
    maxRenderPixels: 2_100_000,
    startStep: 2,
  },
  minimal: {
    name: "minimal",
    texDim: 192,
    maxDpr: 1,
    maxRenderPixels: 1_300_000,
    startStep: 3,
  },
};

const ORDER: LatentProfile["name"][] = ["high", "balanced", "efficient", "minimal"];

/**
 * Pick particle density from signals that are available before WebGL starts.
 * Unknown hardware deliberately lands on balanced: CPU core count is only a
 * rough GPU proxy, so absence of data must not be treated as a flagship GPU.
 *
 * This is only the OPENING bid. The GPU's own renderer string narrows it
 * (classifyRenderer) and measured frame times settle it (PerfGovernor) — a
 * sixteen-core laptop on integrated graphics reports as "capable" here and
 * cannot actually run the high profile.
 */
export function selectLatentProfile(input: LatentProfileInput): LatentProfile {
  const viewportPixels = Math.max(1, input.viewportWidth) * Math.max(1, input.viewportHeight);
  const constrained =
    input.saveData === true ||
    (input.deviceMemory !== undefined && input.deviceMemory <= 4) ||
    (input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 4);

  if (constrained) return PROFILES.efficient;

  const capable =
    input.deviceMemory !== undefined &&
    input.deviceMemory >= 8 &&
    input.hardwareConcurrency !== undefined &&
    input.hardwareConcurrency >= 8 &&
    viewportPixels <= 2_500_000;

  return capable ? PROFILES.high : PROFILES.balanced;
}

export type RendererClass = "software" | "weak" | "modest" | "capable" | "unknown";

/**
 * Bucket a WEBGL_debug_renderer_info string.
 *
 * This is the signal that was missing. `hardwareConcurrency` says nothing about
 * the GPU, so a mid-range laptop with a fast CPU and Intel UHD graphics was
 * being handed a quarter-million particles at 1.5x DPR — which renders, but at
 * single-digit frame rates, i.e. it looks BROKEN rather than slow.
 *
 * Software rasterisers are hopeless at any setting and are told so, so the
 * caller can show its CSS fallback immediately instead of freezing the tab.
 */
export function classifyRenderer(renderer: string): RendererClass {
  const r = renderer.toLowerCase();
  if (!r) return "unknown";

  // No GPU at all: a driver fallback, a VM, or a blocklisted card.
  if (/swiftshader|llvmpipe|softpipe|basic render|software adapter|mesa offscreen/.test(r)) {
    return "software";
  }

  // Discrete / Apple silicon / recent mobile flagships.
  if (
    /geforce|quadro|rtx|gtx|radeon (rx|pro|hd 7|r9)|apple m\d|adreno \(tm\) (6[5-9]\d|7\d\d|8\d\d)|mali-g(7[0-9]|8\d)/.test(
      r,
    )
  ) {
    return "capable";
  }

  // Old integrated: pre-Xe Intel, Vega/UHD mobile parts, old mobile GPUs. These
  // are the machines the field used to die on.
  if (
    /(intel).*(hd graphics|uhd graphics|gma|q45|4000|4400|4600|5[0-9]{2}0|6[0-9]{2}0)|mali-[t4]|adreno \(tm\) [2-5]\d\d|videocore|powervr sgx/.test(
      r,
    )
  ) {
    return "weak";
  }

  // Iris / Xe / Vega integrated / unnamed integrated — runs, but not at full tilt.
  if (/intel|iris|xe graphics|vega|radeon|amd|microsoft|angle/.test(r)) return "modest";

  return "unknown";
}

/** Narrow an opening profile with what the GPU actually turned out to be.
 *  Returns null when nothing is worth rendering — the caller falls back. */
export function applyRendererClass(
  profile: LatentProfile,
  cls: RendererClass,
): LatentProfile | null {
  if (cls === "software") return null;
  const cap =
    cls === "weak" ? "minimal" : cls === "modest" ? "efficient" : cls === "unknown" ? "balanced" : null;
  if (!cap) return profile;
  const capped = PROFILES[cap as LatentProfile["name"]];
  return ORDER.indexOf(profile.name) >= ORDER.indexOf(capped.name) ? profile : capped;
}

/**
 * Calculate a backing-buffer size that is valid on the current GPU.
 * CSS dimensions stay unchanged; only internal render resolution is reduced.
 */
export function getSafeCanvasSize(input: SafeCanvasInput) {
  const cssWidth = Math.max(1, input.cssWidth);
  const cssHeight = Math.max(1, input.cssHeight);
  const maxTextureSize = Math.max(1, input.maxTextureSize);
  const maxRenderPixels = Math.max(1, input.maxRenderPixels);
  const areaScale = Math.sqrt(maxRenderPixels / (cssWidth * cssHeight));
  const dpr = Math.max(
    Number.EPSILON,
    Math.min(
      Math.max(Number.EPSILON, input.devicePixelRatio),
      Math.max(Number.EPSILON, input.maxDpr),
      maxTextureSize / cssWidth,
      maxTextureSize / cssHeight,
      areaScale,
    ),
  );

  return {
    width: Math.max(1, Math.min(maxTextureSize, Math.floor(cssWidth * dpr))),
    height: Math.max(1, Math.min(maxTextureSize, Math.floor(cssHeight * dpr))),
    dpr,
  };
}

export interface PerfStep {
  /** Multiplier on the profile's DPR budget — fill rate is the bottleneck. */
  renderScale: number;
  /** Frames per second the loop is allowed to draw. */
  fpsCap: number;
}

/**
 * The runtime ladder. Resolution first, because the field is soft and bloomed
 * so a lower buffer is nearly invisible; frame rate only after that, because a
 * clean 30fps reads as cinematic and a stuttering 45 does not.
 */
export const PERF_STEPS: PerfStep[] = [
  { renderScale: 1.0, fpsCap: 60 },
  { renderScale: 0.85, fpsCap: 60 },
  { renderScale: 0.7, fpsCap: 60 },
  { renderScale: 0.7, fpsCap: 30 },
  { renderScale: 0.55, fpsCap: 30 },
];

export type PerfVerdict = "hold" | "changed" | "abort";

/**
 * Closed-loop quality control.
 *
 * Every static heuristic is a guess; the frame clock is not. The governor
 * watches the MEDIAN interval between drawn frames — median, so one garbage
 * collection or one scroll spike cannot demote the whole field — and walks
 * down PERF_STEPS while the field is missing its target, back up while it is
 * comfortably beating it, and gives up entirely only if the cheapest step
 * still cannot hold a watchable rate.
 *
 * That last case is the honest one: a machine that cannot draw this at 18fps
 * should get the CSS fallback, not a slideshow.
 */
export class PerfGovernor {
  private samples: number[] = [];
  private step: number;
  private good = 0;
  private strikes = 0;
  /** Frames to ignore after any change: shader/texture reallocation, first
   *  paint and font swaps all produce long frames that mean nothing. */
  private warmup = 30;

  constructor(startStep = 0) {
    this.step = clampStep(startStep);
  }

  get state(): PerfStep {
    return PERF_STEPS[this.step];
  }

  get level(): number {
    return this.step;
  }

  /** Feed the interval since the previous DRAWN frame, in milliseconds. */
  sample(frameMs: number): PerfVerdict {
    if (this.warmup > 0) {
      this.warmup--;
      return "hold";
    }
    // A frame this long is a tab stall, a resize, or a layout thrash — timing
    // it would demote a healthy field for something that is not its fault.
    if (frameMs > 400) return "hold";
    this.samples.push(frameMs);
    if (this.samples.length < 48) return "hold";

    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.samples.length = 0;

    const target = 1000 / this.state.fpsCap;

    if (median > target * 1.55) {
      this.good = 0;
      if (this.step < PERF_STEPS.length - 1) {
        this.step++;
        this.warmup = 30;
        return "changed";
      }
      // Already at the bottom. Two bad windows in a row, not one, so a single
      // heavy stretch of page does not black out the background.
      this.strikes++;
      return this.strikes >= 2 ? "abort" : "hold";
    }

    this.strikes = 0;
    if (median < target * 1.1 && this.step > 0) {
      this.good++;
      if (this.good >= 5) {
        this.good = 0;
        this.step--;
        this.warmup = 30;
        return "changed";
      }
      return "hold";
    }

    this.good = 0;
    return "hold";
  }
}

function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.min(PERF_STEPS.length - 1, Math.max(0, Math.round(step)));
}

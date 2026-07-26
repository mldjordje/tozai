export interface LatentProfileInput {
  viewportWidth: number;
  viewportHeight: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
}

export interface LatentProfile {
  name: "high" | "balanced" | "efficient";
  texDim: number;
  maxDpr: number;
  maxRenderPixels: number;
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
  },
  balanced: {
    name: "balanced",
    texDim: 384,
    maxDpr: 1.25,
    maxRenderPixels: 3_200_000,
  },
  efficient: {
    name: "efficient",
    texDim: 256,
    maxDpr: 1,
    maxRenderPixels: 2_100_000,
  },
};

/**
 * Pick particle density from signals that are available before WebGL starts.
 * Unknown hardware deliberately lands on balanced: CPU core count is only a
 * rough GPU proxy, so absence of data must not be treated as a flagship GPU.
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

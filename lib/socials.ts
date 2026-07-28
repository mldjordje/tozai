// Social links the studio manages itself.
//
// No `server-only`: the public components need the shape and the platform
// detection, and neither touches the database.

export type SocialLink = {
  label: string;
  url: string;
};

/** Platforms we can draw a recognisable icon for. Anything else renders with a
 *  generic link glyph, which is what makes "add your own" possible at all. */
export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "facebook"
  | "x"
  | "threads"
  | "whatsapp"
  | "telegram"
  | "generic";

const HOSTS: [RegExp, SocialPlatform][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(twitter\.com|x\.com)$/, "x"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)(t\.me|telegram\.me|telegram\.org)$/, "telegram"],
];

/**
 * Which icon a link gets. The URL decides, not the label: the studio types
 * whatever name it likes ("Naš IG", "Backup nalog") and still gets the right
 * glyph. The label is only checked when the URL says nothing useful.
 */
export function socialPlatform(link: SocialLink): SocialPlatform {
  try {
    const host = new URL(normalizeSocialUrl(link.url)).hostname.replace(/^www\./, "");
    for (const [pattern, platform] of HOSTS) {
      if (pattern.test(host)) return platform;
    }
  } catch {
    // Unparseable URL — fall through to the label.
  }
  const label = link.label.toLowerCase();
  for (const platform of ["instagram", "tiktok", "youtube", "linkedin", "facebook", "threads", "whatsapp", "telegram"] as const) {
    if (label.includes(platform)) return platform;
  }
  if (label === "x" || label.includes("twitter")) return "x";
  return "generic";
}

/** People paste "instagram.com/toza.aii" as often as the full URL, and a bare
 *  href without a scheme resolves against our own origin — a link to a 404. */
export function normalizeSocialUrl(url: string): string {
  const value = url.trim();
  if (!value) return "";
  return /^(https?:)?\/\//i.test(value) ? value.replace(/^\/\//, "https://") : `https://${value}`;
}

/** Drops entries the studio left half-filled, so the public row never renders a
 *  dead icon. */
export function cleanSocialLinks(value: unknown, max = 12): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const url = typeof row.url === "string" ? row.url.trim().slice(0, 300) : "";
      if (!url) return null;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 60) : "";
      return { label: label || hostLabel(url), url };
    })
    .filter((item): item is SocialLink => item !== null)
    .slice(0, max);
}

/** A readable fallback name when the studio pastes a link and types nothing. */
function hostLabel(url: string): string {
  try {
    const host = new URL(normalizeSocialUrl(url)).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return "Link";
  }
}

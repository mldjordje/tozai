// Offerings data — AI-clip packages + 1-on-1 education hour-packs.
//
// The LIVE source of truth is the `packages` table, edited in /admin/paketi and
// read by lib/packages.ts; the two arrays at the bottom of this file are the
// offline mirror the sections fall back to when that read comes back empty (see
// getPublicPackages, which swallows a DB error into []). The mappers in between
// turn a table row into the shape a card renders.
//
// So: change prices and tiers in the admin panel. Only re-seeding the catalogue
// wholesale — a different set of services, not a different price — needs this
// file touched, and then scripts/set-packages-2026-07.mjs is the other half.

export type ClipPackage = {
  id: string;
  name: string;
  /** Reference price, admin-side only. Every video package is quoted per brief —
   *  scope, length and turnaround all move the number — so the public card shows
   *  the "privatna procena" pill instead and never renders this. Kept optional
   *  because the mapper below still carries whatever the studio stores. */
  price?: string;
  /** Short cadence/qualifier under the price. Not rendered, see `price`. */
  priceNote?: string;
  /** The service in one claim plus its explanation. Packages.tsx lifts the first
   *  sentence out as the card's lead. */
  headline: string;
  features: string[];
  cta: string;
  /** Visually highlight one tier as recommended. */
  featured?: boolean;
  /** Checkout slug. Absent on the static placeholder tiers, which have no
   *  database row and therefore nothing to sell yet. */
  slug?: string;
};

export type HourPack = {
  id: string;
  hours: number;
  label: string;
  /** Display price string — placeholder until admin-driven. */
  price: string;
  /** e.g. "€40 / sat" effective rate line. */
  perHour?: string;
  note?: string;
  featured?: boolean;
  /** Checkout slug — see ClipPackage.slug. */
  slug?: string;
};

// --- AI-clip packages (section: #paketi) --------------------------------
// Mirrors the `packages` rows seeded by scripts/set-packages-2026-07.mjs, in the
// same order, so an unreachable database renders the real catalogue rather than
// a set of placeholder tiers that no longer exist. Edits belong in the admin
// panel; this list only has to stay recognisable.
//
// COPY RULE — applies here and, more importantly, to the same `description`
// field in /admin/paketi, which overrides everything below.
//
// A package headline describes the deliverable. It does not promise a business
// outcome — no ROI, no guaranteed reach, no conversion lift — and it does not
// name another company's brand as a style ("Pixar-style"). Both shapes read to
// Meta's automated review as deceptive commercial practice, and both were on
// this page when the studio's Instagram was restricted from sharing links.
export const CLIP_PACKAGES: ClipPackage[] = [
  {
    id: "ai-performance-ads",
    name: "AI Performance Ads",
    headline:
      "Video oglasi za Meta i TikTok. Format, dužina i uvodni kadar prilagođeni platformi na kojoj se prikazuju.",
    features: [],
    cta: "Pošalji upit",
  },
  {
    id: "ai-virality-growth",
    name: "AI Virality Growth",
    headline:
      "Serijski kratki sadržaj za organski rast. Planiramo teme, tempo objavljivanja i više varijanti uvoda za testiranje.",
    features: [],
    cta: "Pošalji upit",
  },
  {
    id: "ai-cinematic-ads",
    name: "AI Cinematic Ads",
    headline:
      "Reklame filmskog kvaliteta. Kadar, tempo i ton pisani za tvoj brend, ne po šablonu.",
    features: [],
    cta: "Pošalji upit",
  },
  {
    id: "ai-vsl-architect",
    name: "AI VSL Architect",
    headline:
      "Video Sales Letters. Scenario struktuiran oko jedne jasne ponude i jednog poziva na akciju.",
    features: [],
    cta: "Pošalji upit",
  },
  {
    id: "3d-medical-vision",
    name: "3D Medical Vision",
    headline:
      "Medicinske i naučne 3D vizuelizacije. Visok nivo detalja, za edukaciju i prezentacije.",
    features: [],
    cta: "Pošalji upit",
  },
  {
    id: "ai-toon-storytelling",
    name: "AI Toon Storytelling",
    headline:
      "Animirano pripovedanje u 3D crtanom stilu. Dizajn likova i emotivna priča oko tvog brenda.",
    features: [],
    cta: "Pošalji upit",
  },
];

// --- admin/DB → section mappers -----------------------------------------
// A pricing row as it comes from the `packages` table (admin panel). Kept as a
// plain shape here so these mappers stay client-safe (no server-only imports).
export type PackageRow = {
  id: number;
  name: string;
  price: number | null;
  currency: string;
  unit: string | null;
  description: string | null;
  features: string[];
  highlighted: boolean;
  cta_label: string | null;
  /** Checkout slug; null for rows created before the shop layer landed. */
  slug?: string | null;
  hours?: number | null;
};

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "€—";
  const n = price.toLocaleString("sr-RS");
  return currency === "EUR" ? `€${n}` : `${n} ${currency}`;
}

// services rail → AI-clip package card (#paketi).
export function toClipPackage(p: PackageRow): ClipPackage {
  return {
    id: String(p.id),
    name: p.name,
    price: formatPrice(p.price, p.currency),
    priceNote: p.unit ?? undefined,
    headline: p.description ?? "",
    features: p.features,
    cta: p.cta_label ?? "Pošalji upit",
    featured: p.highlighted,
    slug: p.slug ?? undefined,
  };
}

// education rail → 1-on-1 hour-pack card (#edukacija).
export function toHourPack(p: PackageRow): HourPack {
  const hours =
    (p.hours ?? Number((p.name.match(/\d+/) ?? p.unit?.match(/\d+/) ?? [])[0])) || 0;
  const perHour =
    hours > 0 && p.price != null && p.currency === "EUR"
      ? `€${Math.round(p.price / hours)} / sat`
      : undefined;
  return {
    id: String(p.id),
    hours,
    label: p.name,
    price: formatPrice(p.price, p.currency),
    perHour,
    note: p.description ?? undefined,
    featured: p.highlighted,
    slug: p.slug ?? undefined,
  };
}

// --- 1-on-1 education hour-packs (section: #edukacija) -------------------
// Same contract as CLIP_PACKAGES above: the offline mirror of the seeded
// education rail. `perHour` is the effective rate the DB mapper computes, spelled
// out here so the fallback shows the same descending rate the real cards do.
export const HOUR_PACKS: HourPack[] = [
  {
    id: "ai-strategy-call",
    hours: 1,
    label: "AI Strategy Call",
    price: "€99",
    perHour: "€99 / sat",
  },
  {
    id: "ai-kickstart",
    hours: 2,
    label: "AI Kickstart",
    price: "€180",
    perHour: "€90 / sat",
  },
  {
    id: "ai-content-accelerator",
    hours: 5,
    label: "AI Content Accelerator",
    price: "€400",
    perHour: "€80 / sat",
  },
  {
    id: "ai-business-mastery",
    hours: 10,
    label: "AI Business Mastery",
    price: "€700",
    perHour: "€70 / sat",
  },
  {
    id: "full-ai-transformation",
    hours: 20,
    label: "Full AI Transformation",
    price: "€1.200",
    perHour: "€60 / sat",
  },
];

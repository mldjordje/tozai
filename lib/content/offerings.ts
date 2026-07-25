// Offerings data — AI-clip packages + 1-on-1 education hour-packs.
//
// TODO(admin): these arrays are the single source of truth for the pricing
// sections. Prices/tiers are meant to be editable from an admin panel later,
// so keep this shape stable and swap the constant for a fetch (Supabase /
// admin API) without touching the section components. Everything here is
// PLACEHOLDER content until the admin flow lands.

export type ClipPackage = {
  id: string;
  name: string;
  /** Display price string incl. currency — placeholder until admin-driven. */
  price: string;
  /** Short cadence/qualifier under the price, e.g. "jednokratno". */
  priceNote?: string;
  /** Headline deliverable, e.g. "10 AI klipova". */
  headline: string;
  features: string[];
  cta: string;
  /** Visually highlight one tier as recommended. */
  featured?: boolean;
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
};

// --- AI-clip packages (section: #paketi) --------------------------------
export const CLIP_PACKAGES: ClipPackage[] = [
  {
    id: "starter",
    name: "Starter",
    price: "€—",
    priceNote: "jednokratno",
    headline: "Paket kratkih AI klipova",
    features: [
      "Set AI video klipova",
      "Vertikalni format (Reels / TikTok / Shorts)",
      "Osnovni brendiranje i tekst",
      "1 krug revizija",
    ],
    cta: "Naruči",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€—",
    priceNote: "jednokratno",
    headline: "Više klipova + brža isporuka",
    features: [
      "Veći set AI klipova",
      "Hook + caption optimizacija",
      "Prilagođeno tvom brendu",
      "2 kruga revizija",
      "Prioritetna isporuka",
    ],
    cta: "Naruči",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "€—",
    priceNote: "mesečno",
    headline: "Stalni priliv sadržaja",
    features: [
      "Mesečna produkcija klipova",
      "Content plan + teme",
      "Neograničene sitne izmene",
      "Namenski kontakt",
    ],
    cta: "Kontakt",
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
    cta: p.cta_label ?? "Naruči",
    featured: p.highlighted,
  };
}

// education rail → 1-on-1 hour-pack card (#edukacija).
export function toHourPack(p: PackageRow): HourPack {
  const hours = Number((p.name.match(/\d+/) ?? p.unit?.match(/\d+/) ?? [])[0]) || 0;
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
  };
}

// --- 1-on-1 education hour-packs (section: #edukacija) -------------------
export const HOUR_PACKS: HourPack[] = [
  {
    id: "h1",
    hours: 1,
    label: "Proba",
    price: "€—",
    perHour: "€— / sat",
    note: "Jedan termin, konkretan problem.",
  },
  {
    id: "h5",
    hours: 5,
    label: "Fokus",
    price: "€—",
    perHour: "€— / sat",
    note: "Kroz ceo tvoj sadržaj workflow.",
    featured: true,
  },
  {
    id: "h10",
    hours: 10,
    label: "Mentorstvo",
    price: "€—",
    perHour: "€— / sat",
    note: "Dugoročno, od nule do sistema.",
  },
];

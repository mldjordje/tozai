// Landing copy — the single schema shared by the public page and the admin
// editor.
//
// Every string the buyer reads on "/" lives here. DEFAULTS is what the site
// says out of the box; the admin panel writes overrides into
// site_content['landing'] and getLandingContent() (landing.server.ts) merges
// the two. An empty admin field means "use the default", never "render
// nothing" — a half-filled form must not blank out a section.
//
// This module stays free of `server-only` on purpose: the section components
// are client components and import the types (and their default props) from
// here. The database read lives in landing.server.ts.
//
// TITLE SYNTAX. Headline fields go through KineticTitle/AccentText, which mark
// the word wrapped in asterisks as the italic accent: "Svaki broj je *stvaran*."
// Hero titles additionally split on "\n" for the line break.

export type Stat = { value: string; label: string };

export type LandingContent = {
  // --- hero ---
  hero_eyebrow: string;
  hero_title: string;
  hero_lead_1: string;
  hero_lead_2: string;
  hero_body: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;

  // --- 01 brojevi ---
  stats_eyebrow: string;
  stats_title: string;
  stats: Stat[];

  // --- marquee ---
  strip_items: string[];

  // --- rezultati ---
  results_eyebrow: string;
  results_title: string;
  results_body: string;
  results_card_title: string;
  results_cta: string;

  // --- 02 paketi ---
  packages_eyebrow: string;
  packages_title: string;
  packages_body: string;
  packages_note: string;

  // --- 03 edukacija ---
  education_eyebrow: string;
  education_title: string;
  education_body: string;
  education_pills: string[];

  // --- booking ---
  booking_badge: string;
  booking_title: string;
  booking_cta_primary: string;
  booking_note: string;

  // --- footer ---
  footer_tagline: string;
  footer_response: string;
};

export const DEFAULTS: LandingContent = {
  hero_eyebrow: "AI Video Studio",
  hero_title: "Build Your Business\nWith *AI*.",
  hero_lead_1: "Ne učimo AI. Gradimo biznise uz AI.",
  hero_lead_2: "Pametnije. Brže. Profitabilnije.",
  hero_body:
    "Kreiramo AI video reklame i pružamo privatnu AI edukaciju — sadržaj koji zaustavlja skrol i uči te da ga praviš sam.",
  hero_cta_primary: "Poruči AI video",
  hero_cta_secondary: "Pogledaj pakete",

  stats_eyebrow: "01 — Brojevi",
  stats_title: "Brojevi koji rade *za sebe*.",
  stats: [
    { value: "16M+", label: "Monthly Views" },
    { value: "5000+", label: "AI Videos Created" },
    { value: "100+", label: "Clients" },
    { value: "2+", label: "Years Creating Content" },
  ],

  strip_items: ["AI VIDEO", "VIRAL SADRŽAJ", "AI EDUKACIJA", "TOZA AI"],

  results_eyebrow: "Real rezultati",
  results_title: "Svaki kadar je AI. Svaki broj je *stvaran*.",
  results_body:
    "300K+ pratilaca i 100+ miliona pregleda na profilima koje vodimo — skroluj i pregledaj dokaze.",
  results_card_title: "Hoćeš ovakve *brojke*?",
  results_cta: "Pošalji upit",

  packages_eyebrow: "02 — Paketi",
  packages_title: "AI video po meri. *Ponuda po briefu*.",
  packages_body:
    "Izaberi smer i pošalji ideju. Dobijaš privatnu cenu i realno vreme izrade pre nego što bilo šta potvrdiš.",
  packages_note:
    "Slanje upita je besplatno i ne obavezuje te na kupovinu. Cena je vidljiva samo na tvom nalogu, nakon procene.",

  education_eyebrow: "03 — Privatna edukacija",
  education_title: "Nauči da praviš sadržaj *koji prodaje*.",
  education_body:
    "1-na-1 mentorstvo. Kupuješ sate, rezervišeš termin, učiš tačno ono što tvom biznisu treba.",
  education_pills: ["1-na-1 mentorstvo", "Tvoj tempo", "Konkretno za tvoj biznis"],

  booking_badge: "Odgovaramo u roku od 24h",
  booking_title: "Hajde da napravimo *tvoj sadržaj*.",
  booking_cta_primary: "Pošalji upit",
  booking_note: "Upit je besplatan i ne obavezuje te.",

  footer_tagline:
    "AI video reklame i privatna AI edukacija. Upit je besplatan i ne obavezuje te na kupovinu.",
  footer_response: "Odgovaramo u roku od 24h.",
};

/** Fields the admin editor renders as free text, in the order it renders them.
 *  Structured fields (stats, pills, strip) get their own editors. */
export const TEXT_FIELDS = Object.keys(DEFAULTS).filter(
  (key) => typeof DEFAULTS[key as keyof LandingContent] === "string",
) as (keyof LandingContent)[];

// The first shipped version of the admin editor used these keys. They are read
// once here so copy written before the schema grew is not silently dropped.
const LEGACY_ALIASES: Partial<Record<keyof LandingContent, string>> = {
  hero_title: "hero_title",
  hero_body: "hero_subtitle",
  hero_cta_primary: "hero_cta",
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  return items.length > 0 ? items : null;
}

function statList(value: unknown): Stat[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const statValue = text(row.value);
      const label = text(row.label);
      return statValue && label ? { value: statValue, label } : null;
    })
    .filter((item): item is Stat => item !== null);
  return items.length > 0 ? items : null;
}

/**
 * Overlay admin-written values on the defaults. Pure and total: any shape of
 * stored JSON produces a complete, renderable LandingContent, because a typo in
 * the database must not be able to take the landing page down.
 */
export function mergeLandingContent(stored: unknown): LandingContent {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const merged = { ...DEFAULTS };

  for (const key of TEXT_FIELDS) {
    const alias = LEGACY_ALIASES[key];
    const value = text(raw[key]) ?? (alias ? text(raw[alias]) : null);
    if (value) (merged[key] as string) = value;
  }

  merged.stats = statList(raw.stats) ?? DEFAULTS.stats;
  merged.strip_items = stringList(raw.strip_items) ?? DEFAULTS.strip_items;
  merged.education_pills = stringList(raw.education_pills) ?? DEFAULTS.education_pills;

  return merged;
}

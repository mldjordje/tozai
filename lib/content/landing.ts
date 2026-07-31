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

// COPY RULE — read before editing anything below, and before editing the same
// fields in /admin/sadrzaj.
//
// This page is shared as a link on Meta and TikTok, where an automated reviewer
// reads it long before a buyer does. Two shapes get a domain flagged under
// "fraud, scams and deceptive practices", and the site was restricted once for
// carrying them:
//
//   1. Promised outcomes — earnings, profit, return on investment, guaranteed
//      reach or conversion. Say what we make, not what it will do for them.
//   2. Numbers with no visible proof. Every figure here has to be one a visitor
//      can check in the Rezultati rail below it; an impressive invented one
//      costs more than it earns.
//
// The terms page disclaiming results does not help: the classifier reads the
// landing, not /uslovi.
export const DEFAULTS: LandingContent = {
  hero_eyebrow: "AI Video Studio",
  hero_title: "AI video,\n*po meri*.",
  hero_lead_1: "Ne pričamo o AI. Pravimo sa njim.",
  hero_lead_2: "Od ideje do isporuke. Bez klasičnog snimanja.",
  hero_body:
    "Izrađujemo AI video reklame po briefu i držimo privatnu 1-na-1 AI edukaciju.",
  hero_cta_primary: "Poruči AI video",
  hero_cta_secondary: "Pogledaj pakete",

  stats_eyebrow: "01 — Studio",
  stats_title: "Jasno je *ko smo i šta radimo*.",
  // Keep the landing rail factual and identity-led. Audience and view counts
  // remain visible on their individual portfolio screenshots, where a visitor
  // can inspect the source instead of being asked to trust an aggregate claim.
  stats: [
    { value: "AI", label: "Video produkcija po briefu" },
    { value: "1-na-1", label: "Privatna AI edukacija" },
    { value: "Niš", label: "Registrovan studio u Srbiji" },
  ],

  strip_items: ["AI VIDEO", "VIRAL SADRŽAJ", "AI EDUKACIJA", "TOZA AI"],

  results_eyebrow: "Real rezultati",
  results_title: "Javni primeri rada i *profili iza njih*.",
  results_body:
    "Pogledaj odabrane AI radove i snimke javnih profila koje vodimo. Rezultati prethodnih projekata nisu garancija budućeg učinka.",
  results_card_title: "Hoćeš ovakav *sadržaj*?",
  results_cta: "Pošalji upit",

  packages_eyebrow: "02 — Paketi",
  packages_title: "AI video po meri. *Ponuda po briefu*.",
  packages_body:
    "Izaberi smer i pošalji ideju. Dobijaš privatnu cenu i realno vreme izrade pre nego što bilo šta potvrdiš.",
  packages_note:
    "Slanje upita je besplatno i ne obavezuje te na kupovinu. Cena je vidljiva samo na tvom nalogu, nakon procene.",

  education_eyebrow: "03 — Privatna edukacija",
  education_title: "Nauči da praviš sadržaj *sam*.",
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

/**
 * The English landing, out of the box.
 *
 * Not a translation of the Serbian row — a starting point the studio edits in
 * /admin/sadrzaj under the EN tab, the same way it edits the Serbian one. The
 * two are stored under separate site_content keys and never fall back to each
 * other: an English page rendering half in Serbian is worse than one rendering
 * the English default.
 *
 * Numbers, brand names and the marquee stay as they are — they read the same in
 * both languages and translating them would only make them wrong.
 */
export const DEFAULTS_EN: LandingContent = {
  hero_eyebrow: "AI Video Studio",
  hero_title: "AI video,\n*made to order*.",
  hero_lead_1: "We don't talk about AI. We build with it.",
  hero_lead_2: "From brief to delivery. No traditional film shoot.",
  hero_body:
    "We produce AI video ads to a brief and provide private 1-on-1 AI training.",
  hero_cta_primary: "Order an AI video",
  hero_cta_secondary: "See the packages",

  stats_eyebrow: "01 — Studio",
  stats_title: "Clear about *who we are and what we do*.",
  // Mirrors the Serbian identity-led rail. Performance figures belong beside
  // their source in the portfolio, not as an aggregate marketing promise.
  stats: [
    { value: "AI", label: "Video production to a brief" },
    { value: "1-on-1", label: "Private AI training" },
    { value: "Niš", label: "Registered studio in Serbia" },
  ],

  strip_items: ["AI VIDEO", "VIRAL CONTENT", "AI EDUCATION", "TOZA AI"],

  results_eyebrow: "Real results",
  results_title: "Public work samples and *the profiles behind them*.",
  results_body:
    "See selected AI work and snapshots of public profiles we manage. Past project results do not guarantee future performance.",
  results_card_title: "Want content *like this*?",
  results_cta: "Send a brief",

  packages_eyebrow: "02 — Packages",
  packages_title: "AI video, made to order. *Quoted from your brief*.",
  packages_body:
    "Pick a direction and send the idea. You get a private price and a realistic turnaround before you commit to anything.",
  packages_note:
    "Sending a brief is free and commits you to nothing. The price is visible only in your account, after we quote it.",

  education_eyebrow: "03 — Private education",
  education_title: "Learn to make the content *yourself*.",
  education_body:
    "1-on-1 mentoring. Buy hours, book a slot, learn exactly what your business needs.",
  education_pills: ["1-on-1 mentoring", "Your pace", "Built around your business"],

  booking_badge: "We reply within 24h",
  booking_title: "Let's make *your content*.",
  booking_cta_primary: "Send a brief",
  booking_note: "The brief is free and commits you to nothing.",

  footer_tagline:
    "AI video ads and private AI training. Sending a brief is free and commits you to nothing.",
  footer_response: "We reply within 24h.",
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
export function mergeLandingContent(
  stored: unknown,
  base: LandingContent = DEFAULTS,
): LandingContent {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const merged = { ...base };

  for (const key of TEXT_FIELDS) {
    const alias = LEGACY_ALIASES[key];
    const value = text(raw[key]) ?? (alias ? text(raw[alias]) : null);
    if (value) (merged[key] as string) = value;
  }

  merged.stats = statList(raw.stats) ?? base.stats;
  merged.strip_items = stringList(raw.strip_items) ?? base.strip_items;
  merged.education_pills = stringList(raw.education_pills) ?? base.education_pills;

  return merged;
}

/** Which set of defaults a locale starts from. */
export function landingDefaults(locale: string): LandingContent {
  return locale === "en" ? DEFAULTS_EN : DEFAULTS;
}

/** The site_content row a locale's overrides live in. */
export function landingContentKey(locale: string): string {
  return locale === "en" ? "landing_en" : "landing";
}

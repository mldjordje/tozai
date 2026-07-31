// Fill in the English side of the catalogue and the proof rail.
//
//   node scripts/en-content-2026-07-31.mjs        (reads DATABASE_URL from .env.local)
//
// The English columns (description_en, cta_label_en, stat_en, alt_en …) were all
// null, and the reads fall back per field to Serbian — so /en rendered English
// headings above Serbian package copy and Serbian captions under every
// screenshot. Not wrong, but a visitor arriving from a shared link sees a page
// that looks half-finished, which is the opposite of what the rest of the
// 31 Jul 2026 pass is for.
//
// The descriptions are the English wording of the rewritten Serbian ones, and
// carry the same constraint: what the studio delivers, never what the buyer
// will earn, and no other company's brand used as a style. Read the COPY RULE
// in lib/content/offerings.ts before editing either side.
//
// Everything written here stays editable under the English tab in /admin/paketi
// and /admin/rezultati. Idempotent: re-running writes the same values.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

const SERVICES = {
  "services-ai-performance-ads":
    "Video ads for Meta and TikTok. Format, length and opening shot matched to the platform they run on.",
  "services-ai-virality-growth":
    "Short-form content in series, for organic growth. We plan the topics, the posting rhythm and several hook variants to test.",
  "services-ai-cinematic-ads":
    "Ads with a cinematic finish. Framing, pace and tone written for your brand, not off a template.",
  "services-ai-vsl-architect":
    "Video Sales Letters. A script built around one clear offer and one call to action.",
  "services-3d-medical-vision":
    "Medical and scientific 3D visualisation. A high level of detail, for teaching and presentations.",
  "services-ai-toon-storytelling":
    "Animated storytelling in a 3D cartoon style. Character design and an emotional story around your brand.",
};

// The card CTA and the rail label above it. Left in English on the English
// route only — the Serbian columns are untouched.
const SERVICE_CTA = "Send a brief";
const SERVICE_CATEGORY = "AI Video";
const EDUCATION_CATEGORY = "Education";

for (const [slug, description] of Object.entries(SERVICES)) {
  const rows = await sql`
    UPDATE packages
       SET description_en = ${description},
           cta_label_en = ${SERVICE_CTA},
           category_en = ${SERVICE_CATEGORY},
           updated_at = NOW()
     WHERE slug = ${slug}
       AND (description_en IS DISTINCT FROM ${description}
            OR cta_label_en IS DISTINCT FROM ${SERVICE_CTA}
            OR category_en IS DISTINCT FROM ${SERVICE_CATEGORY})
    RETURNING id
  `;
  console.log(`${rows.length ? "updated  " : "unchanged"}  ${slug}`);
}

{
  const rows = await sql`
    UPDATE packages
       SET category_en = ${EDUCATION_CATEGORY}, updated_at = NOW()
     WHERE grp = 'education' AND category_en IS DISTINCT FROM ${EDUCATION_CATEGORY}
    RETURNING id
  `;
  console.log(`${rows.length} education row(s) categorised in English`);
}

// The proof rail. Keyed by the Serbian caption rather than by id, so a row the
// studio has since replaced is skipped instead of mislabelled.
const SHOTS = [
  {
    stat: "207K pratilaca · Instagram",
    stat_en: "207K followers · Instagram",
    alt_en: "toza.aii — Instagram profile, 207K followers, verified",
  },
  {
    stat: "AI GENERACIJA ZA SAMO 3 MESECA NA JEDNOJ PLATFORMI",
    stat_en: "AI GENERATIONS IN JUST 3 MONTHS ON A SINGLE PLATFORM",
    alt_en: "toza.aii",
  },
  {
    stat: "22.1K pratilaca · 753K lajkova",
    stat_en: "22.1K followers · 753K likes",
    alt_en: "Darija Ai — TikTok profile, 22.1K followers, 753K likes",
  },
  {
    stat: "69.5K pratilaca · 609K lajkova",
    stat_en: "69.5K followers · 609K likes",
    alt_en: "Toza Ai — TikTok profile, 69.5K followers, 609K likes",
  },
  {
    stat: "43K+ lajkova po objavi",
    stat_en: "43K+ likes per post",
    alt_en: "TikTok Insights — tens of thousands of likes per post",
  },
  {
    stat: "12.3K pratilaca · Instagram",
    stat_en: "12.3K followers · Instagram",
    alt_en: "Kaja Sretic — Instagram AI profile, 12.3K followers",
  },
  {
    stat: "15.3K pratilaca · 183K lajkova",
    stat_en: "15.3K followers · 183K likes",
    alt_en: "kajina.perspektiva — TikTok profile, 15.3K followers, 183K likes",
  },
];

for (const shot of SHOTS) {
  const rows = await sql`
    UPDATE result_shots
       SET stat_en = ${shot.stat_en}, alt_en = ${shot.alt_en}
     WHERE stat = ${shot.stat}
       AND (stat_en IS DISTINCT FROM ${shot.stat_en} OR alt_en IS DISTINCT FROM ${shot.alt_en})
    RETURNING id
  `;
  console.log(`${rows.length ? "updated  " : "unchanged"}  shot "${shot.stat_en}"`);
}

console.log("\nDone.");

// Strip the copy that got the studio's Instagram restricted from sharing links.
//
//   node scripts/meta-safe-copy-2026-07-31.mjs        (reads DATABASE_URL from .env.local)
//
// On 31 Jul 2026 Meta restricted @toza.aii from sharing links for 30 days under
// "fraud, scams and deceptive practices". Nothing on the site is untrue — every
// AI clip is labelled as AI and the studio is a registered PR — but three shapes
// in the live copy are the ones an automated reviewer scores as a scam:
//
//   1. Promised business outcomes. Six service descriptions sold ROI, "milionski
//      pregledi" and a "drastično" higher conversion rate.
//   2. Large performance totals on the sales page. Even when individual
//      screenshots are genuine, an automated reviewer cannot reliably verify
//      an aggregate "100M+ views / 300K+ followers" claim.
//   3. Another company's brand used as a style: "Magija u Pixar stilu".
//   4. Product names that imply a buyer outcome: "Virality Growth", "Business
//      Mastery" and "Full AI Transformation".
//
// This script rewrites 1 and 3 in the `packages` rows and drops the `stats`
// override from both landing rows so the (rewritten, provable) defaults in
// lib/content/landing.ts take over. The matching source-file copy is already
// updated — this is the half that the admin panel owns.
//
// Idempotent: re-running writes the same values. Descriptions set here stay
// editable in /admin/paketi, and the stats rail in /admin/sadrzaj — but read the
// COPY RULE comments in lib/content/landing.ts and lib/content/offerings.ts
// before putting a number or a promise back.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

// Deliverable, not outcome. Each one says what the studio hands over.
const PACKAGES = {
  "services-ai-performance-ads": {
    name: "AI Platform Ads",
    nameEn: "AI Platform Ads",
    description:
      "Video oglasi za Meta i TikTok. Format, dužina i uvodni kadar prilagođeni platformi na kojoj se prikazuju.",
    descriptionEn:
      "Video ads for Meta and TikTok. Format, length and opening shot matched to the platform they run on.",
  },
  "services-ai-virality-growth": {
    name: "AI Short-Form Series",
    nameEn: "AI Short-Form Series",
    description:
      "Serijski kratki sadržaj za društvene mreže. Planiramo teme, tempo objavljivanja i više varijanti uvoda za testiranje.",
    descriptionEn:
      "Short-form content in series for social platforms. We plan the topics, the posting rhythm and several hook variants to test.",
  },
  "services-ai-cinematic-ads": {
    name: "AI Cinematic Ads",
    nameEn: "AI Cinematic Ads",
    description:
      "Reklame filmskog kvaliteta. Kadar, tempo i ton pisani za tvoj brend, ne po šablonu.",
    descriptionEn:
      "Ads with a cinematic finish. Framing, pace and tone written for your brand, not off a template.",
  },
  "services-ai-vsl-architect": {
    name: "AI VSL Production",
    nameEn: "AI VSL Production",
    description:
      "Video Sales Letters. Scenario struktuiran oko jedne jasne ponude i jednog poziva na akciju.",
    descriptionEn:
      "Video Sales Letters. A script built around one clear offer and one call to action.",
  },
  "services-3d-medical-vision": {
    name: "3D Medical Visuals",
    nameEn: "3D Medical Visuals",
    description:
      "Medicinske i naučne 3D vizuelizacije. Visok nivo detalja, za edukaciju i prezentacije.",
    descriptionEn:
      "Medical and scientific 3D visualisation. A high level of detail, for teaching and presentations.",
  },
  "services-ai-toon-storytelling": {
    name: "AI 3D Storytelling",
    nameEn: "AI 3D Storytelling",
    description:
      "Animirano pripovedanje u 3D crtanom stilu. Dizajn likova i emotivna priča oko tvog brenda.",
    descriptionEn:
      "Animated storytelling in a 3D cartoon style. Character design and a story built around your brand.",
  },
  "education-ai-strategy-call": { name: "AI konsultacije — 1h", nameEn: "AI consultation — 1h" },
  "education-ai-kickstart": { name: "AI mentorstvo — 2h", nameEn: "AI mentoring — 2h" },
  "education-ai-content-accelerator": { name: "AI mentorstvo — 5h", nameEn: "AI mentoring — 5h" },
  "education-ai-business-mastery": { name: "AI mentorstvo — 10h", nameEn: "AI mentoring — 10h" },
  "education-full-ai-transformation": { name: "AI mentorstvo — 20h", nameEn: "AI mentoring — 20h" },
};

let changed = 0;
for (const [slug, patch] of Object.entries(PACKAGES)) {
  const description = patch.description ?? null;
  const descriptionEn = patch.descriptionEn ?? null;
  const rows = await sql`
    UPDATE packages
       SET name = ${patch.name},
           name_en = ${patch.nameEn},
           description = COALESCE(${description}, description),
           description_en = COALESCE(${descriptionEn}, description_en),
           updated_at = NOW()
     WHERE slug = ${slug}
       AND (name IS DISTINCT FROM ${patch.name}
            OR name_en IS DISTINCT FROM ${patch.nameEn}
            OR (${description}::text IS NOT NULL AND description IS DISTINCT FROM ${description})
            OR (${descriptionEn}::text IS NOT NULL AND description_en IS DISTINCT FROM ${descriptionEn}))
    RETURNING id
  `;
  if (rows.length) changed += 1;
  console.log(`${rows.length ? "updated" : "unchanged"}  ${slug}`);
}

// Remove risky landing overrides rather than overwrite them:
// mergeLandingContent treats a missing key as "use the default", leaving one
// reviewed source of truth instead of a safe file hidden by stale CMS copy.
const LANDING_FIELDS = [
  "hero_title",
  "hero_lead_2",
  "hero_body",
  "stats_eyebrow",
  "stats_title",
  "stats",
  "results_title",
  "results_body",
];

for (const key of ["landing", "landing_en"]) {
  let removed = 0;
  for (const field of LANDING_FIELDS) {
    const rows = await sql`
      UPDATE site_content SET value = value - ${field}
      WHERE key = ${key} AND value ? ${field}
      RETURNING key
    `;
    removed += rows.length;
  }
  console.log(`${removed ? `dropped ${removed} risky override(s)` : "no risky overrides"}  ${key}`);
}

console.log(`\nDone. ${changed} package description(s) rewritten.`);

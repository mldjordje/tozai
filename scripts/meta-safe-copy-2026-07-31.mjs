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
//   2. Numbers with no proof, and numbers that contradict each other. The stats
//      rail claimed 50M monthly views while the results section below it claimed
//      100M views in total, alongside "5000+ AI Videos" and "100+ Clients" that
//      nothing on the site evidences.
//   3. Another company's brand used as a style: "Magija u Pixar stilu".
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
const DESCRIPTIONS = {
  "services-ai-performance-ads":
    "Video oglasi za Meta i TikTok. Format, dužina i uvodni kadar prilagođeni platformi na kojoj se prikazuju.",
  "services-ai-virality-growth":
    "Serijski kratki sadržaj za organski rast. Planiramo teme, tempo objavljivanja i više varijanti uvoda za testiranje.",
  "services-ai-cinematic-ads":
    "Reklame filmskog kvaliteta. Kadar, tempo i ton pisani za tvoj brend, ne po šablonu.",
  "services-ai-vsl-architect":
    "Video Sales Letters. Scenario struktuiran oko jedne jasne ponude i jednog poziva na akciju.",
  "services-3d-medical-vision":
    "Medicinske i naučne 3D vizuelizacije. Visok nivo detalja, za edukaciju i prezentacije.",
  "services-ai-toon-storytelling":
    "Animirano pripovedanje u 3D crtanom stilu. Dizajn likova i emotivna priča oko tvog brenda.",
};

let changed = 0;
for (const [slug, description] of Object.entries(DESCRIPTIONS)) {
  const rows = await sql`
    UPDATE packages SET description = ${description}, updated_at = NOW()
    WHERE slug = ${slug} AND description IS DISTINCT FROM ${description}
    RETURNING id
  `;
  if (rows.length) changed += 1;
  console.log(`${rows.length ? "updated" : "unchanged"}  ${slug}`);
}

// Remove the override rather than overwrite it: mergeLandingContent treats a
// missing key as "use the default", so the rail follows lib/content/landing.ts
// from here on and there is one place left to get this wrong instead of two.
for (const key of ["landing", "landing_en"]) {
  const rows = await sql`
    UPDATE site_content SET value = value - 'stats'
    WHERE key = ${key} AND value ? 'stats'
    RETURNING key
  `;
  console.log(`${rows.length ? "dropped stats override" : "no stats override"}  ${key}`);
}

console.log(`\nDone. ${changed} package description(s) rewritten.`);

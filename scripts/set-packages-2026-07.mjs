// Replace the whole cenovnik with the July 2026 catalogue.
//
//   npm run db:packages:2026-07     (reads DATABASE_URL from .env.local)
//
// Two rails:
//   services  — six AI video products, quoted per brief. No price and no clip
//               count on the card by design: scope, length and turnaround all
//               move the number, so flow='project' sends the buyer to the brief
//               and the studio quotes by hand.
//   education — five 1-on-1 hour packs, sold outright at a fixed price.
//
// Old rows are RETIRED (active = false), not deleted. Ten orders, four projects
// and fourteen video requests point at them through package_id, and those FKs are
// ON DELETE SET NULL — deleting the rows would quietly erase which package each
// historical order was for. Retired rows disappear from the public site
// immediately (getPublicPackages filters on active) and can be removed one by one
// from /admin/paketi once the studio is sure it no longer needs the history.
//
// Idempotent: re-running upserts by slug, so it is safe to run again after an
// edit to the list below. Prices set here are editable in /admin/paketi
// afterwards — this script is the seed, not the source of truth.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

/** Same shape the existing rows use: "<grp>-<name>", slugified. */
const slugFor = (grp, name) =>
  `${grp}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// --- the catalogue, in display order ---------------------------------------

const SERVICES = [
  [
    "AI Performance Ads",
    "Prodaja vođena podacima. Optimizovani video oglasi za Meta i TikTok sa fokusom na maksimalan povraćaj investicije (ROI).",
  ],
  [
    "AI Virality Growth",
    "Dominacija algoritmom. Naučno vođena strategija rasta koja koristi AI za postizanje milionskih pregleda i organsku ekspanziju.",
  ],
  [
    "AI Cinematic Ads",
    "Brending budućnosti. Vrhunske reklame filmskog kvaliteta koje pozicioniraju vaš biznis kao lidera u industriji.",
  ],
  [
    "AI VSL Architect",
    "Prodajna moć u svakom kadru. Psihološki optimizovani Video Sales Letters koji drastično povećavaju stopu konverzije.",
  ],
  [
    "3D Medical Vision",
    "Preciznost koja edukuje. Kompleksne medicinske i naučne vizuelizacije kroz naprednu 3D AI tehnologiju visokog nivoa detalja.",
  ],
  [
    "AI Toon Storytelling",
    "Magija u Pixar stilu. Emotivne i vizuelno zapanjujuće animacije koje oživljavaju vaš brend kroz vrhunski 3D umetnički stil.",
  ],
];

const EDUCATION = [
  ["AI Strategy Call", 1, 99],
  ["AI Kickstart", 2, 180],
  ["AI Content Accelerator", 5, 400],
  ["AI Business Mastery", 10, 700],
  ["Full AI Transformation", 20, 1200],
];

const rows = [
  ...SERVICES.map(([name, description], sort) => ({
    grp: "services",
    category: "AI Video",
    name,
    // null price renders as "na upit" anywhere a price is shown at all; the
    // #paketi card shows the private-quote pill instead and never reads it.
    price: null,
    unit: null,
    description,
    features: [],
    cta_label: "Pošalji upit",
    flow: "project",
    hours: null,
    sort,
  })),
  ...EDUCATION.map(([name, hours, price], sort) => ({
    grp: "education",
    category: "Edukacija",
    name,
    price,
    unit: `/ ${hours}h`,
    // No blurb supplied for the hour packs; the card renders label, hours,
    // price and the effective per-hour rate without one. Add a one-liner in
    // /admin/paketi (Opis) if the studio wants a note under the price.
    description: null,
    features: [],
    cta_label: null,
    flow: "hours",
    hours,
    sort,
  })),
];

// --- apply -----------------------------------------------------------------

const keep = rows.map((r) => slugFor(r.grp, r.name));

const retired = await sql`
  UPDATE packages
  SET active = false, highlighted = false, updated_at = now()
  WHERE active AND (slug IS NULL OR slug <> ALL (${keep}::text[]))
  RETURNING id, grp, name
`;
for (const r of retired) console.log(`retired  ${r.grp}/${r.name} (#${r.id})`);

for (const r of rows) {
  const slug = slugFor(r.grp, r.name);
  const [row] = await sql`
    INSERT INTO packages (
      grp, category, name, price, currency, unit, description, features,
      highlighted, cta_label, cta_href, sort, active, slug, flow, hours, updated_at
    ) VALUES (
      ${r.grp}, ${r.category}, ${r.name}, ${r.price}, 'EUR', ${r.unit},
      ${r.description}, ${r.features}::text[], false, ${r.cta_label}, null, ${r.sort},
      true, ${slug}, ${r.flow}, ${r.hours}, now()
    )
    ON CONFLICT (slug) DO UPDATE SET
      grp = EXCLUDED.grp,
      category = EXCLUDED.category,
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      unit = EXCLUDED.unit,
      description = EXCLUDED.description,
      features = EXCLUDED.features,
      cta_label = EXCLUDED.cta_label,
      sort = EXCLUDED.sort,
      active = true,
      flow = EXCLUDED.flow,
      hours = EXCLUDED.hours,
      updated_at = now()
    RETURNING id
  `;
  console.log(`upserted ${r.grp}/${r.name} (#${row.id}) → /porudzbina/${slug}`);
}

console.log(`\ndone — ${SERVICES.length} services + ${EDUCATION.length} education packs active.`);
console.log("The landing revalidates within 60s, or instantly on the next admin save.");

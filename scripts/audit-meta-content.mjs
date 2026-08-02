// Read-only check for public CMS copy that commonly trips automated link review.
// Usage: node scripts/audit-meta-content.mjs

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);
const risky = /100M|300K|Build Your Business|Virality Growth|Business Mastery|Full AI Transformation|organski rast/i;
// Any aggregate "big number +" claim — the stats rail is exactly where a
// re-added "200M+ Pregleda ostvarenih" (fixed 2 Aug 2026, see
// scripts/fix-stats-claim-2026-08.mjs) got past the fixed keyword list above.
// This does not run against result_shots: a per-account follower count there
// ("207K pratilaca · Instagram") is the individually verifiable case the
// original fix explicitly left alone, and would false-positive here.
const aggregateNumber = /\d[\d.,]*\s*[MKmk]\+/;
let findings = 0;

const landing = await sql`
  SELECT key, value FROM site_content
  WHERE key IN ('landing', 'landing_en')
  ORDER BY key
`;

for (const row of landing) {
  const text = JSON.stringify(row.value);
  if (risky.test(text) || aggregateNumber.test(text)) {
    findings += 1;
    console.log(`RISK landing override: ${row.key}`);
  } else {
    console.log(`OK   landing override: ${row.key}`);
  }
}

const packages = await sql`
  SELECT slug, name, name_en, description, description_en
  FROM packages
  WHERE active
  ORDER BY grp, sort, id
`;

for (const row of packages) {
  const text = [row.name, row.name_en, row.description, row.description_en].filter(Boolean).join(" ");
  if (risky.test(text)) {
    findings += 1;
    console.log(`RISK package: ${row.slug} — ${row.name}`);
  } else {
    console.log(`OK   package: ${row.slug} — ${row.name}`);
  }
}

// The `faq` table renders publicly too (see components/sections/Faq.tsx) and
// was the one CMS surface this audit did not read — added 2026-08-02 after the
// razvoj rail and FAQ section shipped, so a future FAQ edit through the panel
// gets the same check as everything else on the page.
const faq = await sql`
  SELECT id, question, answer, question_en, answer_en FROM faq WHERE active ORDER BY sort, id
`;

for (const row of faq) {
  const text = [row.question, row.answer, row.question_en, row.answer_en].filter(Boolean).join(" ");
  if (risky.test(text)) {
    findings += 1;
    console.log(`RISK faq #${row.id}: ${row.question}`);
  } else {
    console.log(`OK   faq #${row.id}: ${row.question}`);
  }
}

console.log(`\n${findings ? `Found ${findings} risky CMS row(s).` : "No risky CMS copy found."}`);
process.exitCode = findings ? 1 : 0;

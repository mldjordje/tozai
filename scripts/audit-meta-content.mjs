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
let findings = 0;

const landing = await sql`
  SELECT key, value FROM site_content
  WHERE key IN ('landing', 'landing_en')
  ORDER BY key
`;

for (const row of landing) {
  const text = JSON.stringify(row.value);
  if (risky.test(text)) {
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

console.log(`\n${findings ? `Found ${findings} risky CMS row(s).` : "No risky CMS copy found."}`);
process.exitCode = findings ? 1 : 0;

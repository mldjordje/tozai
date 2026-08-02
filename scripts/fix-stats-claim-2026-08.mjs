// Drops the "200M+ Pregleda ostvarenih na našim AI objavama" stat that was
// re-added to site_content.landing through /admin/sadrzaj after the 31 Jul
// 2026 Meta review. Same category the original fix removed: an aggregate
// number an automated reviewer cannot verify from the page (see
// scripts/meta-safe-copy-2026-07-31.mjs). Individual, named public-profile
// screenshots in `result_shots` (toza.aii — 207K, @tozaai — 69.5K, ...) are
// left alone — those are per-account and click-through verifiable, which is
// the distinction the original fix drew.
//
//   node scripts/fix-stats-claim-2026-08.mjs        (reads DATABASE_URL from .env.local)
//
// Idempotent: only removes a stat whose label matches, safe to re-run.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

const RISKY = /pregleda ostvarenih|views achieved|\d[\d.,]*\s*[MKmk]\+/;

const rows = await sql`SELECT key, value FROM site_content WHERE key IN ('landing', 'landing_en')`;

for (const row of rows) {
  const stats = row.value?.stats;
  if (!Array.isArray(stats)) {
    console.log(`${row.key}: no stats override, nothing to do`);
    continue;
  }
  const kept = stats.filter((s) => !RISKY.test(`${s.label} ${s.value}`));
  if (kept.length === stats.length) {
    console.log(`${row.key}: stats present, none risky`);
    continue;
  }
  const removed = stats.filter((s) => RISKY.test(`${s.label} ${s.value}`));
  const nextValue = { ...row.value };
  if (kept.length > 0) {
    nextValue.stats = kept;
  } else {
    delete nextValue.stats; // falls back to the safe code defaults
  }
  await sql`
    UPDATE site_content SET value = ${JSON.stringify(nextValue)}::jsonb, updated_at = now()
    WHERE key = ${row.key}
  `;
  console.log(`${row.key}: removed ${removed.length} risky stat(s):`);
  for (const s of removed) console.log(`   - "${s.value}" ${s.label}`);
}

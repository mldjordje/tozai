// Two loose ends from the 31 Jul 2026 pass, both in the database.
//
//   node scripts/meta-safe-invoice-and-alt-2026-07-31.mjs
//
// 1. The VAT note printed on invoices to a foreign buyer still read
//    "FILL IN WITH ACCOUNTANT — VAT note for services supplied to a foreign
//    business." — the seeded placeholder. It goes on every foreign invoice the
//    studio issues, which is the one document a client keeps and forwards to
//    their own accountant. Set to the English wording of the domestic note.
//
// Idempotent: re-running writes the same values.
//
// The "verifikovan" / "verified" wording in the proof-rail alt text was briefly
// removed here and then put back: @toza.aii carries the badge, so it is a
// checkable fact about the account rather than a claim about results, and a
// reviewer confirming it is a point in the studio's favour. It is listed as a
// non-change below so nobody removes it again for the same wrong reason.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

// The English rendering of vat_note_domestic. Same statement — the studio is
// not in the VAT system and the invoice is valid unsigned — for a reader who
// does not read Serbian. It is not a place-of-supply or reverse-charge
// determination; if the accountant wants one, it is edited in
// /admin/podesavanja and this script is not re-run.
const VAT_NOTE_FOREIGN =
  "The supplier is not registered for VAT. This invoice is valid without a signature or a stamp.";

{
  const rows = await sql`
    UPDATE studio_settings
       SET vat_note_foreign = ${VAT_NOTE_FOREIGN}
     WHERE id = 1 AND vat_note_foreign IS DISTINCT FROM ${VAT_NOTE_FOREIGN}
    RETURNING id
  `;
  console.log(`${rows.length ? "updated  " : "unchanged"}  vat_note_foreign`);
}

// The captions the rail should carry, in both languages. Written out rather
// than left alone so the pair cannot drift: the English column is what /en
// renders, and a Serbian caption leaking onto the English page is how this
// started.
const ALTS = [
  {
    match: "toza.aii",
    alt: "toza.aii — Instagram profil, 207K pratilaca, verifikovan",
    alt_en: "toza.aii — Instagram profile, 207K followers, verified",
  },
];

for (const row of ALTS) {
  const rows = await sql`
    UPDATE result_shots
       SET alt = ${row.alt}, alt_en = ${row.alt_en}
     WHERE alt LIKE ${row.match + "%"}
       AND (alt IS DISTINCT FROM ${row.alt} OR alt_en IS DISTINCT FROM ${row.alt_en})
    RETURNING id
  `;
  console.log(`${rows.length ? "updated  " : "unchanged"}  alt: ${row.alt}`);
}

console.log("\nDone.");

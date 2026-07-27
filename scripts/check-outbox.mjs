// What actually left the building. Run: npm run email:check
//
// The outbox is the only record of a send attempt — Resend's own log is 24h on
// the free plan, and a queued row that never went out looks identical to a
// delivered one from inside the app. Three states worth knowing apart:
//
//   sent    → Resend accepted it (provider_ref is their id)
//   failed  → Resend rejected it; `error` says why (usually an unverified from)
//   pending → nothing was even attempted: RESEND_API_KEY or EMAIL_FROM missing
//             at the moment it was queued. There is no retry — these are dead.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);
const limit = Number(process.argv[2] ?? 15);

const counts = await sql`
  SELECT status, count(*)::int AS n FROM email_outbox GROUP BY status ORDER BY status
`;
console.log("\nstatus:", counts.map((r) => `${r.status}=${r.n}`).join("  ") || "prazno");

const rows = await sql`
  SELECT id, created_at, status, template_key, recipient, error
  FROM email_outbox ORDER BY id DESC LIMIT ${limit}
`;

console.log("");
for (const r of rows) {
  const when = new Date(r.created_at).toLocaleString("sr-RS");
  const mark = r.status === "sent" ? "OK  " : r.status === "failed" ? "FAIL" : "??  ";
  console.log(`${mark} #${r.id}  ${when}  ${r.template_key} → ${r.recipient}`);
  if (r.error) console.log(`     ${r.error}`);
}

const stuck = counts.find((r) => r.status === "pending");
if (stuck) {
  console.log(
    `\n${stuck.n} reda u 'pending' — upisani dok RESEND_API_KEY nije postojao. ` +
      "Nema retry mehanizma, ti mejlovi nikad neće otići.",
  );
}
console.log("");

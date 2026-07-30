// Idempotent production migration for the invoice compliance fields.
// Run BEFORE deploying code that selects these columns — the new code reads both,
// and a missing column fails the whole invoice-issuing path.
//
// Additive only: two ADD COLUMN IF NOT EXISTS and one backfill that touches
// nothing already set. Old code ignores both columns, so running this ahead of the
// deploy is safe in either order of arrival.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);

// Date of supply — a mandatory element of a Serbian invoice, and explicitly not
// the same as the date of issue or the date of payment.
await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supply_date DATE`;
await sql`UPDATE invoices SET supply_date = issued_at WHERE supply_date IS NULL`;

// 'none' or '97'. Defaults to 'none': an issuer who does not already use a poziv
// na broj should not have one invented for them.
await sql`
  ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS payment_reference_model TEXT NOT NULL DEFAULT 'none'
`;

const [check] = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM invoices) AS invoices,
    (SELECT COUNT(*)::int FROM invoices WHERE supply_date IS NOT NULL) AS with_supply_date,
    (SELECT payment_reference_model FROM studio_settings WHERE id = 1) AS reference_model
`;

console.log("invoices:", check.invoices);
console.log("with supply_date:", check.with_supply_date);
console.log("payment_reference_model:", check.reference_model);
console.log("Migration complete.");

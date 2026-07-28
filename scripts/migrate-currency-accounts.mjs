// Idempotent production migration for currency-specific invoice accounts.
// Run before deploying code that selects these columns.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS eur_account TEXT`;
await sql`ALTER TABLE studio_settings ADD COLUMN IF NOT EXISTS usd_account TEXT`;
await sql`
  UPDATE studio_settings
  SET eur_account = iban
  WHERE eur_account IS NULL AND iban IS NOT NULL
`;

const [status] = await sql`
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'studio_settings' AND column_name = 'eur_account'
    ) AS has_eur_account,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'studio_settings' AND column_name = 'usd_account'
    ) AS has_usd_account
`;

if (!status?.has_eur_account || !status?.has_usd_account) {
  throw new Error("Currency account migration verification failed.");
}

console.log("Currency account migration complete.");

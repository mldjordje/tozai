// One-off production data cleanup, 2026-07-30.
//
// The admin revenue overview was inflated by test checkouts run against the
// owner's own account (web.wise018@gmail.com) while building the shop. This
// removes that noise WITHOUT touching a single row in `invoices` — every issued
// document keeps its number, its amount, everything — because those are the
// legal documents, and the owner asked explicitly not to touch invoice history.
//
// Two different moves, chosen per order:
//   - DELETE, only for orders with zero linked invoices (6, 7). orders.id is
//     referenced by invoices.order_id ON DELETE CASCADE, so deleting an order
//     that HAS an invoice would silently delete that invoice too — exactly what
//     must not happen. Verified zero-invoice before writing this.
//   - status -> 'canceled', paid_at -> NULL, for orders that DO have an invoice
//     (2, 3, 4, 9 — all four are the owner's own test email). This drops them
//     out of the revenue sum (`WHERE status = 'paid'`) and out of the "Plaćeno"
//     badge (keyed off paid_at in PorudzbineTab.tsx) without deleting the row or
//     touching its invoice.
//
// Left alone: orders 5 (Nikola Belić, 600 EUR) and 11 (Jelena Pušac, 360 EUR) —
// both have real-looking, distinct buyer details; 5's contact also appears on a
// separate order with a full company billing profile (PIB/MB/address), which
// test checkouts never carry. Revenue lands at 960, not the owner's recalled
// ~460 — flagged back to them rather than forced, since hitting 460 exactly
// would mean deleting one of these or editing its amount out of step with its
// own already-issued invoice.
//
// Idempotent: re-running finds nothing left to delete (orders 6/7 gone) and the
// UPDATE's WHERE clause only matches rows still marked paid.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}

const sql = neon(url);

const NO_INVOICE_ORDER_IDS = [6, 7];
const OWNER_TEST_PAID_ORDER_IDS = [2, 3, 4, 9];

// Guard: refuse if either list now has an invoice / isn't paid, rather than
// silently doing the wrong thing to a database that has moved on since this
// script was written.
const [{ with_invoice }] = await sql`
  SELECT COALESCE(array_agg(DISTINCT order_id), '{}') AS with_invoice
  FROM invoices
  WHERE order_id = ANY(${NO_INVOICE_ORDER_IDS})
`;
if (with_invoice.length > 0) {
  console.error(`Refusing: order(s) ${with_invoice.join(", ")} now have an invoice. Aborting.`);
  process.exit(1);
}

const deleted = await sql`
  DELETE FROM orders WHERE id = ANY(${NO_INVOICE_ORDER_IDS}) RETURNING id
`;
console.log("Deleted orders (no invoice):", deleted.map((r) => r.id));

const canceled = await sql`
  UPDATE orders
  SET status = 'canceled', paid_at = NULL
  WHERE id = ANY(${OWNER_TEST_PAID_ORDER_IDS}) AND status = 'paid'
  RETURNING id
`;
console.log("Canceled test orders:", canceled.map((r) => r.id));

const [totals] = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM orders) AS orders,
    (SELECT COUNT(*)::int FROM invoices) AS invoices,
    (SELECT COUNT(*)::int FROM users) AS clients,
    (SELECT COALESCE(SUM(amount), 0)::float8 FROM orders WHERE status = 'paid') AS revenue
`;
console.log("\nResulting dashboard totals:", totals);

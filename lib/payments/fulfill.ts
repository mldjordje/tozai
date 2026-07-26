import "server-only";
import { getSql } from "@/lib/db";

// The single point that turns a paid order into what the buyer bought.
//
// Both the (future) Monri webhook and the admin "mark as paid" action call
// this, so there is exactly one implementation of "what does a purchase
// produce" and the two can never drift apart.
//
// IDEMPOTENCY. Webhooks retry, and a human can double-click. Two mechanisms:
//
//   1. The order is CLAIMED with `UPDATE ... WHERE paid_at IS NULL`, so only
//      one concurrent caller wins the transition to paid.
//   2. Every artifact is created behind a NOT EXISTS guard on order_id, so a
//      re-run after a partial failure finishes the missing pieces instead of
//      duplicating the ones that succeeded.
//
// The second point matters more than it looks: the claim and the artifacts are
// separate statements (the Neon HTTP driver has no interactive transaction), so
// a crash between them would otherwise leave an order marked paid with no
// invoice and no project. Re-running repairs it.

export type FulfillResult = {
  ok: boolean;
  orderId: number;
  alreadyPaid: boolean;
  invoiceCreated: boolean;
  projectId: number | null;
  hoursCredited: number;
};

type OrderRow = {
  id: number;
  user_id: number | null;
  package_id: number | null;
  item: string;
  amount: number;
  currency: string;
  flow: string;
  kind: string | null;
  hours: number | null;
  quote_request_id: number | null;
  paid_at: string | null;
};

export async function fulfillPaidOrder(
  orderId: number,
  options: { provider?: string; providerRef?: string } = {},
): Promise<FulfillResult> {
  const sql = getSql();

  const before = (await sql`
    SELECT id, user_id, package_id, item, amount::float8 AS amount, currency,
           flow, kind, hours::float8 AS hours, paid_at, quote_request_id
    FROM orders WHERE id = ${orderId}
  `) as OrderRow[];
  const order = before[0];
  if (!order) {
    throw new Error(`[fulfill] order ${orderId} not found`);
  }

  const alreadyPaid = order.paid_at !== null;
  if (!alreadyPaid) {
    await sql`
      UPDATE orders
      SET status = 'paid',
          paid_at = now(),
          provider = COALESCE(${options.provider ?? null}, provider),
          provider_ref = COALESCE(${options.providerRef ?? null}, provider_ref)
      WHERE id = ${orderId} AND paid_at IS NULL
    `;
  }

  // --- invoice ------------------------------------------------------------
  // The number is allocated inside the INSERT so the MAX and the write are one
  // statement. Two concurrent callers can still read the same MAX under READ
  // COMMITTED; the UNIQUE index on invoices.number rejects the loser, and the
  // retry picks up the next number.
  const year = new Date().getFullYear();
  const invoiceRows = (await sql`
    INSERT INTO invoices (order_id, number, amount, currency)
    SELECT ${orderId},
           'TZ-' || ${year}::text || '-' ||
             LPAD((COALESCE(MAX(SUBSTRING(i.number FROM 'TZ-[0-9]{4}-([0-9]+)')::int), 0) + 1)::text, 4, '0'),
           ${order.amount},
           ${order.currency}
    FROM invoices i
    WHERE i.number LIKE ${`TZ-${year}-%`}
      AND NOT EXISTS (SELECT 1 FROM invoices x WHERE x.order_id = ${orderId})
    RETURNING id
  `) as { id: number }[];

  let projectId: number | null = null;
  let hoursCredited = 0;

  if (order.flow === "hours") {
    // --- wallet credit ----------------------------------------------------
    const hours = Number(order.hours ?? 0);
    if (hours > 0 && order.user_id) {
      const credited = (await sql`
        INSERT INTO hour_entries (user_id, kind, hours, reason, order_id)
        SELECT ${order.user_id}, ${order.kind ?? "education"}, ${hours}, 'purchase', ${orderId}
        WHERE NOT EXISTS (
          SELECT 1 FROM hour_entries
          WHERE order_id = ${orderId} AND reason = 'purchase'
        )
        RETURNING id
      `) as { id: number }[];
      if (credited.length > 0) hoursCredited = hours;
    }
  } else {
    // --- project ----------------------------------------------------------
    // Revisions come from the package so the client dashboard can enforce the
    // limit the buyer actually paid for.
    if (order.user_id) {
      const created = (await sql`
        INSERT INTO projects (
          order_id, user_id, package_id, title, status, brief, revisions_left, due_date
        )
        SELECT ${orderId}, ${order.user_id}, ${order.package_id},
               COALESCE(
                 (SELECT project_title FROM video_requests WHERE id = ${order.quote_request_id}),
                 ${order.item}
               ),
               'onboarding',
               (
                 SELECT brief || jsonb_build_object(
                   'biznis', business_name,
                   'o_biznisu', business_description,
                   'broj_klipova', clip_count
                 )
                 FROM video_requests WHERE id = ${order.quote_request_id}
               ),
               COALESCE(
                 (SELECT revisions FROM video_requests WHERE id = ${order.quote_request_id}),
                 (SELECT revisions FROM packages WHERE id = ${order.package_id}),
                 2
               ),
               (
                 SELECT CURRENT_DATE + turnaround_days
                 FROM video_requests WHERE id = ${order.quote_request_id}
               )
        WHERE NOT EXISTS (SELECT 1 FROM projects WHERE order_id = ${orderId})
        RETURNING id
      `) as { id: number }[];
      projectId = created[0]?.id ?? null;
      if (projectId) {
        await sql`
          INSERT INTO project_updates (project_id, status, note, author)
          VALUES (${projectId}, 'onboarding', 'Porudžbina je plaćena — dodaj materijale da krene izrada.', 'system')
        `;
      } else {
        const existing = (await sql`
          SELECT id FROM projects WHERE order_id = ${orderId}
        `) as { id: number }[];
        projectId = existing[0]?.id ?? null;
      }
    }
  }

  return {
    ok: true,
    orderId,
    alreadyPaid,
    invoiceCreated: invoiceRows.length > 0,
    projectId,
    hoursCredited,
  };
}

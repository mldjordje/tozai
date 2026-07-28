import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/payments/fulfill";
import { cleanText } from "@/lib/video-requests";
import { queueQuietly } from "@/lib/email";
import { renderStoredInvoice } from "@/lib/invoices/issue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Orders as the studio sees them, plus the one action the manual payment flow
// cannot do without: confirming that the money arrived.
//
// Until Monri is wired, every order is settled by bank transfer — the gateway
// that would flip an order to paid does not exist yet. Without this endpoint a
// paid customer stays stuck on `pending`: no invoice, no project, nothing for
// either side to work with. The button is the human stand-in for the webhook,
// and it calls the same `fulfillPaidOrder()` the webhook will call, so the two
// paths can never produce different results.
//
// Staff-only: `/api/admin/*` is behind the admin session in middleware.ts.

type OrderRow = {
  id: number;
  status: string;
  paid_at: string | null;
  amount: number;
  currency: string;
  item: string;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
};

export async function GET() {
  const sql = getSql();
  const orders = await sql`
    SELECT o.id, o.item, o.amount::float8 AS amount, o.currency, o.status,
           o.flow, o.kind, o.hours::float8 AS hours, o.buyer_type,
           o.provider, o.provider_ref, o.note,
           o.payment_method,
           CASE WHEN o.payment_method = 'invoice'
                THEN 'TZ-' || LPAD(o.id::text, 5, '0') ELSE NULL END AS payment_reference,
           o.paid_at, o.created_at, o.quote_request_id,
           u.email AS user_email, u.name AS user_name, u.phone AS user_phone,
           (SELECT i.number FROM invoices i
            WHERE i.order_id = o.id AND i.kind = 'invoice' LIMIT 1) AS invoice_number,
           (SELECT i.number FROM invoices i
             WHERE i.order_id = o.id AND i.kind = 'proforma' LIMIT 1) AS proforma_number,
           (SELECT i.id FROM invoices i
             WHERE i.order_id = o.id AND i.kind = 'proforma' LIMIT 1) AS proforma_id,
           p.id AS project_id, p.status AS project_status
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN projects p ON p.order_id = o.id
    ORDER BY (o.paid_at IS NOT NULL), o.created_at DESC
    LIMIT 300
  `;
  return NextResponse.json({ ok: true, orders });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || !["mark-paid", "payment-reminder"].includes(String(body.action))) {
    return NextResponse.json({ ok: false, message: "Neispravna akcija." }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT o.id, o.status, o.paid_at, o.amount::float8 AS amount, o.currency, o.item,
           o.user_id, u.email AS user_email, u.name AS user_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = ${id}
  `) as OrderRow[];
  const order = rows[0];
  if (!order) {
    return NextResponse.json({ ok: false, message: "Porudžbina nije pronađena." }, { status: 404 });
  }

  if (body.action === "payment-reminder") {
    if (order.paid_at || order.status === "canceled" || !order.user_email) {
      return NextResponse.json(
        { ok: false, message: "Podsetnik može da se pošalje samo za neplaćenu porudžbinu." },
        { status: 409 },
      );
    }
    const invoices = (await sql`
      SELECT id, number FROM invoices
      WHERE order_id = ${id} AND kind = 'proforma'
      LIMIT 1
    `) as { id: number; number: string }[];
    const proforma = invoices[0];
    const rendered = proforma ? await renderStoredInvoice(proforma.id) : null;
    const result = await queueQuietly({
      userId: order.user_id,
      recipient: order.user_email,
      templateKey: "payment_reminder",
      subject: proforma
        ? `Podsetnik za predračun ${proforma.number}`
        : `Podsetnik za porudžbinu #${id}`,
      body: [
        `Zdravo ${order.user_name?.split(" ")[0] ?? ""},`,
        "",
        `Porudžbina #${id} (${order.item}) još čeka uplatu.`,
        `Iznos: ${order.amount.toLocaleString("sr-RS")} ${order.currency}`,
        `Poziv na broj: TZ-${String(id).padStart(5, "0")}`,
        "",
        `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/nalog/porudzbine`,
        "",
        "TOZA AI",
      ].join("\n"),
      attachments: rendered
        ? [{
            filename: `${rendered.number}.pdf`,
            content: Buffer.from(rendered.bytes).toString("base64"),
          }]
        : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // Free text so the studio can record how it was settled — a bank statement
  // reference, or "test" while the flow is being walked through.
  const reference = cleanText(body.reference, 120) || null;

  // The confirmation mail moved into fulfillPaidOrder(), so the card return and
  // the mock provider send it too — this button is no longer the only way an
  // order becomes paid.
  const result = await fulfillPaidOrder(id, {
    provider: "manual",
    providerRef: reference ?? `RUCNO-${id}`,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
  });

  return NextResponse.json({ ...result, ok: true });
}

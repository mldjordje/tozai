import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/payments/fulfill";
import { queueTransactionalEmail } from "@/lib/email";
import { cleanText } from "@/lib/video-requests";

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
           o.paid_at, o.created_at, o.quote_request_id,
           u.email AS user_email, u.name AS user_name, u.phone AS user_phone,
           i.number AS invoice_number,
           p.id AS project_id, p.status AS project_status
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN invoices i ON i.order_id = o.id
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
  if (!Number.isInteger(id) || body.action !== "mark-paid") {
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

  // Free text so the studio can record how it was settled — a bank statement
  // reference, or "test" while the flow is being walked through.
  const reference = cleanText(body.reference, 120) || null;

  const result = await fulfillPaidOrder(id, {
    provider: "manual",
    providerRef: reference ?? `RUCNO-${id}`,
  });

  // Only on the transition. Re-running to repair a half-finished fulfilment
  // must not mail the customer a second time.
  if (!result.alreadyPaid && order.user_id && order.user_email) {
    const destination = result.projectId
      ? `/nalog/projekti/${result.projectId}`
      : result.hoursCredited > 0
        ? "/nalog/edukacija"
        : "/nalog/porudzbine";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    await queueTransactionalEmail({
      userId: order.user_id,
      recipient: order.user_email,
      templateKey: "order_paid",
      subject: `Uplata je evidentirana — ${order.item}`,
      body: [
        `Zdravo ${order.user_name?.split(" ")[0] ?? ""},`,
        "",
        `Evidentirali smo uplatu za porudžbinu #${order.id} (${order.amount.toLocaleString("sr-RS")} ${order.currency}).`,
        result.projectId
          ? "Projekat je otvoren — pošalji materijale da krene izrada:"
          : result.hoursCredited > 0
            ? `Dodali smo ti ${result.hoursCredited} sati na nalog:`
            : "Detalje vidiš na svom nalogu:",
        `${baseUrl}${destination}`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ ...result, ok: true });
}

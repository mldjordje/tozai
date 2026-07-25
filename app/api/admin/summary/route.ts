import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dashboard headline counts. Reads real tables; everything is 0 until orders
// start flowing, which is correct for a fresh platform.
export async function GET() {
  const sql = getSql();
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [counts] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS clients,
      (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS orders_pending,
      (SELECT COUNT(*)::int FROM orders WHERE status = 'paid' AND created_at >= ${monthStartIso}) AS orders_month,
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM orders WHERE status = 'paid' AND created_at >= ${monthStartIso}) AS revenue_month,
      (SELECT COUNT(*)::int FROM packages WHERE active) AS active_packages
  `) as {
    clients: number;
    orders_pending: number;
    orders_month: number;
    revenue_month: number;
    active_packages: number;
  }[];

  const recent = (await sql`
    SELECT o.id, o.item, o.amount, o.currency, o.status, o.created_at,
           COALESCE(u.name, u.email, 'Gost') AS client
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
    LIMIT 6
  `) as {
    id: number;
    item: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    client: string;
  }[];

  return NextResponse.json({
    ok: true,
    counts: {
      clients: counts.clients,
      ordersPending: counts.orders_pending,
      ordersMonth: counts.orders_month,
      revenueMonth: Number(counts.revenue_month),
      activePackages: counts.active_packages,
    },
    recent,
  });
}

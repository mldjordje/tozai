import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only analytics. Numbers are real (0 until orders flow). GA4/Clarity/Meta
// Pixel dashboards live outside; this is the on-platform sales view.
export async function GET() {
  const sql = getSql();

  const [totals] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS clients,
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COALESCE(SUM(amount),0)::float8 FROM orders WHERE status = 'paid') AS revenue,
      (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS pending,
      (SELECT COUNT(*)::int FROM invoices) AS invoices
  `) as { clients: number; orders: number; revenue: number; pending: number; invoices: number }[];

  const byMonth = (await sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
    FROM orders
    WHERE created_at >= now() - interval '6 months'
    GROUP BY 1 ORDER BY 1
  `) as { month: string; revenue: number; orders: number }[];

  const topPackages = (await sql`
    SELECT p.name, COUNT(o.id)::int AS sales, COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'paid'),0)::float8 AS revenue
    FROM packages p
    LEFT JOIN orders o ON o.package_id = p.id
    GROUP BY p.id, p.name
    HAVING COUNT(o.id) > 0
    ORDER BY revenue DESC, sales DESC
    LIMIT 8
  `) as { name: string; sales: number; revenue: number }[];

  return NextResponse.json({ ok: true, totals, byMonth, topPackages });
}

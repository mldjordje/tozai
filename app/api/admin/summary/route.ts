import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVENUE_OVERRIDE_KEY = "admin_dashboard_revenue";

// Dashboard headline counts. Reads real tables; everything is 0 until orders
// start flowing, which is correct for a fresh platform.
export async function GET() {
  const sql = getSql();
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthStartIso = `${monthKey}-01`;

  const [counts] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS clients,
      (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS orders_pending,
      (SELECT COUNT(*)::int FROM orders WHERE status = 'paid' AND created_at >= ${monthStartIso}) AS orders_month,
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM orders WHERE status = 'paid' AND created_at >= ${monthStartIso}) AS revenue_month,
      (SELECT COUNT(*)::int FROM packages WHERE active) AS active_packages,
      (SELECT COUNT(*)::int FROM projects
        WHERE status IN ('onboarding', 'u_izradi', 'na_reviziji')) AS active_projects,
      (SELECT COUNT(*)::int FROM project_materials WHERE seen_at IS NULL) AS new_materials,
      (SELECT (value ->> 'revenueMonth')::numeric
         FROM site_content
        WHERE key = ${REVENUE_OVERRIDE_KEY}
          AND value ->> 'month' = ${monthKey}) AS revenue_override
  `) as {
    clients: number;
    orders_pending: number;
    orders_month: number;
    revenue_month: number;
    active_packages: number;
    active_projects: number;
    new_materials: number;
    revenue_override: number | null;
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
      revenueMonth: Number(counts.revenue_override ?? counts.revenue_month),
      activePackages: counts.active_packages,
      activeProjects: counts.active_projects,
      newMaterials: counts.new_materials,
    },
    recent,
  });
}

export async function PUT(request: Request) {
  let body: { revenueMonth?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const revenueMonth = Number(body.revenueMonth);
  if (!Number.isFinite(revenueMonth) || revenueMonth < 0 || revenueMonth > 1_000_000_000) {
    return NextResponse.json(
      { ok: false, message: "Zarada mora biti broj između 0 i 1.000.000.000." },
      { status: 400 },
    );
  }

  const normalizedRevenue = Math.round(revenueMonth * 100) / 100;
  const month = new Date().toISOString().slice(0, 7);
  const value = JSON.stringify({ month, revenueMonth: normalizedRevenue });
  const sql = getSql();

  await sql`
    INSERT INTO site_content (key, value, updated_at)
    VALUES (${REVENUE_OVERRIDE_KEY}, ${value}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
  `;

  return NextResponse.json({ ok: true, revenueMonth: normalizedRevenue });
}

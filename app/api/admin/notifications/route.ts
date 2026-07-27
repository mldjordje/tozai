import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sidebar badge counts. Deliberately tiny — the shell polls it, so it must stay
// a single round trip with no joins.
export async function GET() {
  const sql = getSql();
  const [counts] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM project_materials WHERE seen_at IS NULL) AS new_materials,
      (SELECT COUNT(*)::int FROM video_requests WHERE status = 'submitted') AS new_requests,
      (SELECT COUNT(*)::int FROM projects
        WHERE status IN ('onboarding', 'u_izradi', 'na_reviziji')) AS active_projects,
      (SELECT COUNT(*)::int FROM orders
        WHERE paid_at IS NULL AND status = 'pending') AS unpaid_orders
  `) as {
    new_materials: number;
    new_requests: number;
    active_projects: number;
    unpaid_orders: number;
  }[];

  return NextResponse.json({
    ok: true,
    counts: {
      newMaterials: counts.new_materials,
      newRequests: counts.new_requests,
      activeProjects: counts.active_projects,
      unpaidOrders: counts.unpaid_orders,
    },
  });
}

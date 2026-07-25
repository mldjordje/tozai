import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CRM client list with search + purchase/wallet rollups.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;
  const sql = getSql();
  const clients = (await sql`
    SELECT u.id, u.name, u.email, u.avatar_url, u.phone, u.is_company, u.company_name,
           u.pib, u.city, u.admin_note, u.created_at, u.last_login_at,
           COALESCE(o.orders, 0)::int AS orders_count,
           COALESCE(o.spent, 0)::float8 AS spent,
           COALESCE(w.hours_purchased - w.hours_used, 0)::float8 AS hours_left
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS orders, SUM(amount) FILTER (WHERE status = 'paid') AS spent
      FROM orders GROUP BY user_id
    ) o ON o.user_id = u.id
    LEFT JOIN education_wallet w ON w.user_id = u.id
    WHERE ${q === ""} OR u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.company_name ILIKE ${like}
    ORDER BY u.created_at DESC
    LIMIT 200
  `) as unknown[];
  return NextResponse.json({ ok: true, clients });
}

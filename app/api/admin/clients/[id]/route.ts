import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();

  const [client] = (await sql`
    SELECT id, name, email, phone, is_company, company_name, pib, mb, address, city, admin_note, created_at
    FROM users WHERE id = ${id}
  `) as Record<string, unknown>[];
  if (!client) return NextResponse.json({ ok: false, message: "Nema klijenta" }, { status: 404 });

  const orders = (await sql`
    SELECT id, item, amount::float8 AS amount, currency, status, created_at
    FROM orders WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 50
  `) as unknown[];

  const [wallet] = (await sql`
    SELECT hours_purchased::float8 AS purchased, hours_used::float8 AS used
    FROM education_wallet WHERE user_id = ${id}
  `) as { purchased: number; used: number }[];

  // Per-kind balances, the ledger behind them and the sessions they paid for.
  // Education and consulting hours are separate pots, so a single "hours left"
  // number would be wrong the moment a client holds both.
  // Refunds are positive rows; excluding them from `purchased` (and deriving
  // `used` from the balance) keeps a cancelled session from inflating both
  // numbers. Same reasoning as getWalletBalances().
  const wallets = (await sql`
    SELECT kind,
           COALESCE(SUM(hours) FILTER (WHERE hours > 0 AND reason <> 'refund'), 0)::float8 AS purchased,
           COALESCE(SUM(hours) FILTER (WHERE hours > 0 AND reason <> 'refund'), 0)::float8
             - COALESCE(SUM(hours), 0)::float8 AS used,
           COALESCE(SUM(hours), 0)::float8 AS remaining
    FROM hour_entries WHERE user_id = ${id}
    GROUP BY kind ORDER BY kind
  `) as unknown[];

  const entries = (await sql`
    SELECT id, kind, hours::float8 AS hours, reason, note, order_id, booking_id, created_at
    FROM hour_entries WHERE user_id = ${id}
    ORDER BY created_at DESC, id DESC LIMIT 50
  `) as unknown[];

  const bookings = (await sql`
    SELECT id, kind, date::text AS date, start_slot, hours::float8 AS hours, status, topic
    FROM bookings WHERE user_id = ${id}
    ORDER BY date DESC, start_slot DESC LIMIT 50
  `) as unknown[];

  return NextResponse.json({ ok: true, client, orders, wallet: wallet ?? null, wallets, entries, bookings });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const note = typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 2000) || null : null;
  const sql = getSql();
  await sql`UPDATE users SET admin_note = ${note} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

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

  return NextResponse.json({ ok: true, client, orders, wallet: wallet ?? null });
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

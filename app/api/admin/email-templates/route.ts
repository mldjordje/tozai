import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  const sql = getSql();
  const templates = await sql`SELECT key, name, subject, body, active, updated_at FROM email_templates ORDER BY name`;
  return NextResponse.json({ ok: true, templates });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const key = str(b.key, 60);
  if (!key) return NextResponse.json({ ok: false, message: "Bad key" }, { status: 400 });
  const sql = getSql();
  await sql`
    UPDATE email_templates SET
      subject = CASE WHEN ${"subject" in b} THEN ${str(b.subject, 300)} ELSE subject END,
      body = CASE WHEN ${"body" in b} THEN ${str(b.body, 8000)} ELSE body END,
      active = CASE WHEN ${"active" in b} THEN ${Boolean(b.active)} ELSE active END,
      updated_at = now()
    WHERE key = ${key}
  `;
  return NextResponse.json({ ok: true });
}

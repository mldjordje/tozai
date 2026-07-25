import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editable landing text, stored as one JSONB row under key 'landing'. The public
// site merges these over its defaults.
export async function GET() {
  const sql = getSql();
  const rows = (await sql`SELECT value FROM site_content WHERE key = 'landing'`) as { value: Record<string, unknown> }[];
  return NextResponse.json({ ok: true, content: rows[0]?.value ?? {} });
}

export async function PUT(request: Request) {
  let body: { values?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.values !== "object" || body.values === null || Array.isArray(body.values)) {
    return NextResponse.json({ ok: false, message: "values mora biti objekat" }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO site_content (key, value, updated_at)
    VALUES ('landing', ${JSON.stringify(body.values)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}

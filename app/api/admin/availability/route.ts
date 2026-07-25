import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-defined open days. GET ?month=YYYY-MM lists days that have slots.
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, message: "month=YYYY-MM required" }, { status: 400 });
  }
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = `${new Date(y, m, 1).toISOString().slice(0, 10)}`; // first of next month
  const sql = getSql();
  const rows = (await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, slots
    FROM availability_days
    WHERE date >= ${start} AND date < ${end}
    ORDER BY date
  `) as { date: string; slots: string[] }[];
  return NextResponse.json({ ok: true, days: rows });
}

// PUT { date, slots[] } — empty slots deletes the day (closed).
export async function PUT(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { date?: string; slots?: unknown };
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return NextResponse.json({ ok: false, message: "Bad date" }, { status: 400 });
  }
  const slots = Array.isArray(b.slots)
    ? Array.from(new Set(b.slots.filter((s): s is string => /^\d{2}:\d{2}$/.test(s)))).sort()
    : [];
  const sql = getSql();
  if (slots.length === 0) {
    await sql`DELETE FROM availability_days WHERE date = ${b.date}`;
  } else {
    await sql`
      INSERT INTO availability_days (date, slots) VALUES (${b.date}, ${slots})
      ON CONFLICT (date) DO UPDATE SET slots = EXCLUDED.slots
    `;
  }
  return NextResponse.json({ ok: true, slots });
}

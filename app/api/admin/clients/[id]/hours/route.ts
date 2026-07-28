import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { queueQuietly } from "@/lib/email";
import { formatHours, HOUR_KIND_LABEL } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hand hours to a client who paid outside the shop — cash, on the spot.
//
// This writes a row into the same ledger a card purchase writes to, so the
// wallet, the booking calendar and the CRM history all treat cash hours as
// ordinary hours. A negative amount is a correction (hours given by mistake,
// or a session settled off the books) and is refused if it would push the
// balance below zero — a negative wallet has no meaning.
//
// Staff-only: /api/admin/* sits behind the admin session in middleware.ts.

const MAX_PER_ENTRY = 200;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number((await params).id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, message: "Neispravan klijent." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const hours = Math.round(Number(body.hours) * 100) / 100;
  if (!Number.isFinite(hours) || hours === 0 || Math.abs(hours) > MAX_PER_ENTRY) {
    return NextResponse.json(
      { ok: false, message: `Broj sati mora biti različit od nule i najviše ${MAX_PER_ENTRY}.` },
      { status: 400 },
    );
  }
  const kind = body.kind === "consulting" ? "consulting" : "education";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  const notify = body.notify !== false;

  const sql = getSql();
  const users = (await sql`SELECT id, email, name FROM users WHERE id = ${userId}`) as {
    id: number;
    email: string;
    name: string | null;
  }[];
  const user = users[0];
  if (!user) {
    return NextResponse.json({ ok: false, message: "Klijent nije pronađen." }, { status: 404 });
  }

  const before = (await sql`
    SELECT COALESCE(SUM(hours), 0)::float8 AS remaining
    FROM hour_entries WHERE user_id = ${userId} AND kind = ${kind}
  `) as { remaining: number }[];
  const balance = before[0]?.remaining ?? 0;
  if (balance + hours < 0) {
    return NextResponse.json(
      { ok: false, message: `Klijent ima ${formatHours(balance)} — oduzimanje bi dalo minus.` },
      { status: 409 },
    );
  }

  await sql`
    INSERT INTO hour_entries (user_id, kind, hours, reason, note)
    VALUES (${userId}, ${kind}, ${hours}, ${hours > 0 ? "manual" : "correction"}, ${note})
  `;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  if (notify && hours > 0) {
    await queueQuietly({
      userId,
      recipient: user.email,
      templateKey: "hours_granted",
      subject: `Dodato ${formatHours(hours)} na tvoj nalog`,
      body: [
        `Zdravo ${user.name?.split(" ")[0] ?? ""},`,
        "",
        `Na nalog ti je dodato ${formatHours(hours)} (${HOUR_KIND_LABEL[kind] ?? kind}).`,
        note ? `Napomena: ${note}` : null,
        "",
        "Termine biraš sam u kalendaru:",
        `${baseUrl}/nalog/edukacija`,
        "",
        "TOZA AI",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });
  }

  return NextResponse.json({ ok: true, kind, hours, balance: balance + hours });
}

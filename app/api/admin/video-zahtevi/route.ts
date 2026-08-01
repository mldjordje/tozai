import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { cleanText } from "@/lib/video-requests";
import { queueTransactionalEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getSql();
  const requests = await sql`
    SELECT r.id, r.user_id, r.package_id, r.kind, r.service_name, r.project_title, r.brief,
           r.buyer_type, r.clip_count, r.business_name, r.business_description,
           r.budget_eur::float8 AS budget_eur,
           r.status, r.quoted_amount::float8 AS quoted_amount, r.currency,
           r.turnaround_days, r.quote_valid_until::text AS quote_valid_until,
           r.admin_note, r.revisions, r.quoted_at, r.responded_at, r.order_id, r.created_at,
           u.email AS user_email, u.name AS user_name, u.phone AS user_phone
    FROM video_requests r
    JOIN users u ON u.id = r.user_id
    ORDER BY
      CASE r.status WHEN 'submitted' THEN 0 WHEN 'quoted' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,
      r.created_at DESC
    LIMIT 300
  `;
  return NextResponse.json({ ok: true, requests });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, message: "Neispravan ID." }, { status: 400 });
  }

  if (body.action === "cancel" || body.action === "reopen") {
    const from = body.action === "cancel" ? ["submitted", "quoted"] : ["declined", "canceled"];
    const to = body.action === "cancel" ? "canceled" : "submitted";
    const sql = getSql();
    const changed = (await sql`
      UPDATE video_requests
      SET status = ${to}, updated_at = now()
      WHERE id = ${id} AND status = ANY(${from}::text[])
      RETURNING id
    `) as { id: number }[];
    return changed.length
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, message: "Status više ne dozvoljava ovu izmenu." }, { status: 409 });
  }

  const amount = Number(body.amount);
  const currency = cleanText(body.currency, 8, 3);
  const turnaroundDays = Number(body.turnaroundDays);
  const validUntil = cleanText(body.validUntil, 10, 10);
  const note = cleanText(body.note, 2000);
  const revisions = Number(body.revisions);
  const today = new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(amount) || amount <= 0 || !currency) {
    return NextResponse.json({ ok: false, message: "Cena mora biti veća od nule." }, { status: 400 });
  }
  if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1 || turnaroundDays > 365 || !validUntil || validUntil < today) {
    return NextResponse.json({ ok: false, message: "Vreme izrade mora biti 1–365 dana, a ponuda mora važiti do budućeg datuma." }, { status: 400 });
  }
  if (!Number.isInteger(revisions) || revisions < 0 || revisions > 20) {
    return NextResponse.json({ ok: false, message: "Broj revizija mora biti između 0 i 20." }, { status: 400 });
  }

  const sql = getSql();
  const changed = (await sql`
    UPDATE video_requests
    SET quoted_amount = ${amount}, currency = ${currency.toUpperCase()},
        turnaround_days = ${turnaroundDays}, quote_valid_until = ${validUntil},
        admin_note = ${note || null}, revisions = ${revisions},
        status = 'quoted', quoted_at = now(), updated_at = now()
    WHERE id = ${id} AND status IN ('submitted', 'quoted')
    RETURNING id, user_id, project_title
  `) as { id: number; user_id: number; project_title: string }[];
  if (changed.length === 0) {
    return NextResponse.json({ ok: false, message: "Zahtev nije pronađen ili je već prihvaćen." }, { status: 409 });
  }
  const client = (await sql`
    SELECT email, name FROM users WHERE id = ${changed[0].user_id}
  `) as { email: string; name: string | null }[];
  if (client[0]) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    await queueTransactionalEmail({
      userId: changed[0].user_id,
      recipient: client[0].email,
      templateKey: "video_quote",
      subject: `Stigla je procena za ${changed[0].project_title}`,
      body: [
        `Zdravo ${client[0].name?.split(" ")[0] ?? ""},`,
        "",
        `Tvoja procena je spremna: ${amount.toLocaleString("sr-RS")} ${currency.toUpperCase()}.`,
        `Potrebno vreme izrade: ${turnaroundDays} dana.`,
        `Ponuda važi do ${validUntil}.`,
        "",
        "Pregledaj i potvrdi ponudu na svom TOZA AI nalogu:",
        `${baseUrl}/nalog/zahtevi`,
      ].join("\n"),
    });
  }
  return NextResponse.json({ ok: true });
}

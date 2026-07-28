import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/i18n/revalidate";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  const sql = getSql();
  const items = await sql`
    SELECT id, question, answer, question_en, answer_en, sort, active
    FROM faq ORDER BY sort, id
  `;
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const question = str(b.question, 300);
  const answer = str(b.answer, 3000);
  if (!question || !answer) return NextResponse.json({ ok: false, message: "Pitanje i odgovor su obavezni." }, { status: 400 });
  const sql = getSql();
  const [row] = (await sql`
    INSERT INTO faq (question, answer, question_en, answer_en, sort)
    VALUES (
      ${question}, ${answer}, ${str(b.question_en, 300) || null},
      ${str(b.answer_en, 3000) || null}, ${Number(b.sort) || 0}
    )
    RETURNING id
  `) as { id: number }[];
  revalidatePublic("/");
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  await sql`
    UPDATE faq SET
      question = CASE WHEN ${"question" in b} THEN ${str(b.question, 300)} ELSE question END,
      answer = CASE WHEN ${"answer" in b} THEN ${str(b.answer, 3000)} ELSE answer END,
      question_en = CASE WHEN ${"question_en" in b} THEN ${str(b.question_en, 300) || null} ELSE question_en END,
      answer_en = CASE WHEN ${"answer_en" in b} THEN ${str(b.answer_en, 3000) || null} ELSE answer_en END,
      sort = CASE WHEN ${"sort" in b} THEN ${Number(b.sort) || 0} ELSE sort END,
      active = CASE WHEN ${"active" in b} THEN ${Boolean(b.active)} ELSE active END
    WHERE id = ${id}
  `;
  revalidatePublic("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM faq WHERE id = ${id}`;
  revalidatePublic("/");
  return NextResponse.json({ ok: true });
}

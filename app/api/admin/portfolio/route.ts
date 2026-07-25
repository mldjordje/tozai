import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const tags = (v: unknown) =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [];

export async function GET() {
  const sql = getSql();
  const categories = await sql`SELECT id, name, slug, sort FROM portfolio_categories ORDER BY sort, id`;
  const works = await sql`
    SELECT id, category_id, title, client, media_url, media_type, poster_url, description, tags, featured, sort
    FROM portfolio_works ORDER BY sort, id
  `;
  return NextResponse.json({ ok: true, categories, works });
}

export async function POST(request: Request) {
  const type = new URL(request.url).searchParams.get("type");
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sql = getSql();

  if (type === "category") {
    const name = str(b.name, 80);
    if (!name) return NextResponse.json({ ok: false, message: "Naziv je obavezan." }, { status: 400 });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `kat-${Date.now()}`;
    const [row] = (await sql`
      INSERT INTO portfolio_categories (name, slug, sort)
      VALUES (${name}, ${slug}, ${Number(b.sort) || 0})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `) as { id: number }[];
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  }

  const title = str(b.title, 160);
  const media_url = str(b.media_url, 600);
  if (!title || !media_url) return NextResponse.json({ ok: false, message: "Naslov i medij su obavezni." }, { status: 400 });
  const [row] = (await sql`
    INSERT INTO portfolio_works (category_id, title, client, media_url, media_type, poster_url, description, tags, featured, sort)
    VALUES (
      ${b.category_id ? Number(b.category_id) : null}, ${title}, ${str(b.client, 120) || null},
      ${media_url}, ${str(b.media_type, 12) || "image"}, ${str(b.poster_url, 600) || null},
      ${str(b.description, 600) || null}, ${tags(b.tags)}, ${b.featured === undefined ? true : Boolean(b.featured)},
      ${Number(b.sort) || 0}
    )
    RETURNING id
  `) as { id: number }[];
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  await sql`
    UPDATE portfolio_works SET
      category_id = CASE WHEN ${"category_id" in b} THEN ${b.category_id ? Number(b.category_id) : null} ELSE category_id END,
      title = CASE WHEN ${"title" in b} THEN ${str(b.title, 160)} ELSE title END,
      client = CASE WHEN ${"client" in b} THEN ${str(b.client, 120) || null} ELSE client END,
      media_url = CASE WHEN ${"media_url" in b} THEN ${str(b.media_url, 600)} ELSE media_url END,
      media_type = CASE WHEN ${"media_type" in b} THEN ${str(b.media_type, 12) || "image"} ELSE media_type END,
      poster_url = CASE WHEN ${"poster_url" in b} THEN ${str(b.poster_url, 600) || null} ELSE poster_url END,
      description = CASE WHEN ${"description" in b} THEN ${str(b.description, 600) || null} ELSE description END,
      tags = CASE WHEN ${"tags" in b} THEN ${"tags" in b ? tags(b.tags) : []} ELSE tags END,
      featured = CASE WHEN ${"featured" in b} THEN ${Boolean(b.featured)} ELSE featured END,
      sort = CASE WHEN ${"sort" in b} THEN ${Number(b.sort) || 0} ELSE sort END
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  if (type === "category") {
    await sql`DELETE FROM portfolio_categories WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM portfolio_works WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";
import { parseYouTubeId } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const tags = (v: unknown) =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [];

/** The pasted link is the input; the id is derived here rather than trusted
 *  from the client, so a work can never be stored pointing at one video and
 *  playing another. A media_url that is a YouTube link implies media_type
 *  'youtube' even if the form forgot to say so. */
function youtubeFields(mediaUrl: string, declaredType: string) {
  const id = parseYouTubeId(mediaUrl);
  if (!id) return { youtube_id: null, media_type: declaredType || "image" };
  return { youtube_id: id, media_type: "youtube" };
}

export async function GET() {
  const sql = getSql();
  const categories = await sql`SELECT id, name, slug, sort FROM portfolio_categories ORDER BY sort, id`;
  const works = await sql`
    SELECT id, category_id, title, client, media_url, media_type, youtube_id, poster_url,
           description, tags, featured, sort
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
  const yt = youtubeFields(media_url, str(b.media_type, 12));
  const [row] = (await sql`
    INSERT INTO portfolio_works (category_id, title, client, media_url, media_type, youtube_id, poster_url, description, tags, featured, sort)
    VALUES (
      ${b.category_id ? Number(b.category_id) : null}, ${title}, ${str(b.client, 120) || null},
      ${media_url}, ${yt.media_type}, ${yt.youtube_id}, ${str(b.poster_url, 600) || null},
      ${str(b.description, 600) || null}, ${tags(b.tags)}, ${b.featured === undefined ? true : Boolean(b.featured)},
      COALESCE((SELECT MAX(sort) + 1 FROM portfolio_works), 0)
    )
    RETURNING id
  `) as { id: number }[];
  revalidatePath("/portfolio");
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  const edit = youtubeFields(str(b.media_url, 600), str(b.media_type, 12));
  await sql`
    UPDATE portfolio_works SET
      category_id = CASE WHEN ${"category_id" in b} THEN ${b.category_id ? Number(b.category_id) : null} ELSE category_id END,
      title = CASE WHEN ${"title" in b} THEN ${str(b.title, 160)} ELSE title END,
      client = CASE WHEN ${"client" in b} THEN ${str(b.client, 120) || null} ELSE client END,
      media_url = CASE WHEN ${"media_url" in b} THEN ${str(b.media_url, 600)} ELSE media_url END,
      -- media_type and youtube_id are decided together from the pasted link, so
      -- an edited URL can never leave a stale id behind pointing at the old video.
      media_type = CASE WHEN ${"media_url" in b} THEN ${edit.media_type} ELSE media_type END,
      youtube_id = CASE WHEN ${"media_url" in b} THEN ${edit.youtube_id} ELSE youtube_id END,
      poster_url = CASE WHEN ${"poster_url" in b} THEN ${str(b.poster_url, 600) || null} ELSE poster_url END,
      description = CASE WHEN ${"description" in b} THEN ${str(b.description, 600) || null} ELSE description END,
      tags = CASE WHEN ${"tags" in b} THEN ${"tags" in b ? tags(b.tags) : []} ELSE tags END,
      featured = CASE WHEN ${"featured" in b} THEN ${Boolean(b.featured)} ELSE featured END,
      sort = CASE WHEN ${"sort" in b} THEN ${Number(b.sort) || 0} ELSE sort END
    WHERE id = ${id}
  `;
  revalidatePath("/portfolio");
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
  revalidatePath("/portfolio");
  return NextResponse.json({ ok: true });
}

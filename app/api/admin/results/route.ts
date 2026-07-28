import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CRUD for the proof rail (#portfolio on the landing).
//
// The image itself is already in Blob by the time anything reaches here — the
// browser uploaded it directly (see lib/blob-upload.ts). What this route owns
// is the row, the order, and making sure a deleted row takes its file with it.

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);

export async function GET() {
  const sql = getSql();
  const shots = await sql`
    SELECT id, image_url, blob_pathname, alt, handle, stat, width, height, wide, sort, active
    FROM result_shots
    ORDER BY sort, id
  `;
  return NextResponse.json({ ok: true, shots });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const image_url = str(b.image_url, 600);
  if (!image_url) {
    return NextResponse.json({ ok: false, message: "Slika je obavezna." }, { status: 400 });
  }

  const sql = getSql();
  // New shots land at the end of the rail rather than at position 0, which is
  // where an unset sort would put them — the studio adds its newest proof and
  // expects it after the existing ones, not in front of them.
  const [row] = (await sql`
    INSERT INTO result_shots (image_url, blob_pathname, alt, handle, stat, width, height, wide, sort, active)
    VALUES (
      ${image_url}, ${str(b.blob_pathname, 600) || null}, ${str(b.alt, 300)},
      ${str(b.handle, 120)}, ${str(b.stat, 160)}, ${int(b.width)}, ${int(b.height)},
      ${Boolean(b.wide)},
      COALESCE((SELECT MAX(sort) + 1 FROM result_shots), 0),
      ${b.active === undefined ? true : Boolean(b.active)}
    )
    RETURNING id
  `) as { id: number }[];

  revalidatePath("/");
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sql = getSql();

  // Reordering sends the whole list, because dragging one card changes the
  // position of every card after it — one statement per row, but a single
  // round of intent.
  if (Array.isArray(b.order)) {
    const ids = b.order.map((id) => int(id)).filter((id): id is number => id !== null);
    for (let i = 0; i < ids.length; i++) {
      await sql`UPDATE result_shots SET sort = ${i} WHERE id = ${ids[i]}`;
    }
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  }

  const id = int(b.id);
  if (id === null) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });

  await sql`
    UPDATE result_shots SET
      image_url = CASE WHEN ${"image_url" in b} THEN ${str(b.image_url, 600)} ELSE image_url END,
      blob_pathname = CASE WHEN ${"blob_pathname" in b} THEN ${str(b.blob_pathname, 600) || null} ELSE blob_pathname END,
      alt = CASE WHEN ${"alt" in b} THEN ${str(b.alt, 300)} ELSE alt END,
      handle = CASE WHEN ${"handle" in b} THEN ${str(b.handle, 120)} ELSE handle END,
      stat = CASE WHEN ${"stat" in b} THEN ${str(b.stat, 160)} ELSE stat END,
      width = CASE WHEN ${"width" in b} THEN ${int(b.width)} ELSE width END,
      height = CASE WHEN ${"height" in b} THEN ${int(b.height)} ELSE height END,
      wide = CASE WHEN ${"wide" in b} THEN ${Boolean(b.wide)} ELSE wide END,
      active = CASE WHEN ${"active" in b} THEN ${Boolean(b.active)} ELSE active END
    WHERE id = ${id}
  `;

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = int(new URL(request.url).searchParams.get("id"));
  if (id === null) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });

  const sql = getSql();
  const rows = (await sql`
    DELETE FROM result_shots WHERE id = ${id} RETURNING blob_pathname
  `) as { blob_pathname: string | null }[];

  // The row is gone either way. A failed blob delete leaves an orphan file,
  // which is a storage cost — not a broken page — so it must not fail the
  // request the studio is waiting on. Shots seeded from /public have no
  // pathname and must never be touched here.
  const pathname = rows[0]?.blob_pathname;
  if (pathname && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(pathname);
    } catch (error) {
      console.error("[results] blob delete failed", pathname, error);
    }
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

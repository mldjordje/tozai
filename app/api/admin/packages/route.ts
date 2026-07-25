import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";
import { getAllPackages } from "@/lib/packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin CRUD for the cenovnik. Auth enforced by middleware.ts.

function parseFeatures(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean).slice(0, 40);
  if (typeof input === "string") return input.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40);
  return [];
}

function num(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown, max = 400): string | null {
  return typeof v === "string" ? v.trim().slice(0, max) || null : null;
}

export async function GET() {
  try {
    const packages = await getAllPackages();
    return NextResponse.json({ ok: true, packages });
  } catch {
    return NextResponse.json({ ok: false, message: "DB error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const name = str(b.name, 120);
  if (!name) return NextResponse.json({ ok: false, message: "Naziv je obavezan." }, { status: 400 });

  const sql = getSql();
  const [row] = (await sql`
    INSERT INTO packages (grp, category, name, price, currency, unit, description, features, highlighted, cta_label, cta_href, sort, active)
    VALUES (
      ${str(b.grp, 40) ?? "services"}, ${str(b.category, 80)}, ${name}, ${num(b.price)},
      ${str(b.currency, 8) ?? "EUR"}, ${str(b.unit, 40)}, ${str(b.description, 600)},
      ${parseFeatures(b.features)}, ${Boolean(b.highlighted)}, ${str(b.cta_label, 40)},
      ${str(b.cta_href, 300)}, ${Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0},
      ${b.active === undefined ? true : Boolean(b.active)}
    )
    RETURNING id
  `) as { id: number }[];
  revalidatePath("/");
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });

  const sql = getSql();
  // Only overwrite fields that were sent. Neon's http driver has no nested SQL
  // fragments, so each column uses `CASE WHEN <sent?> THEN <value> ELSE col END`
  // where both the boolean and value are bound params.
  await sql`
    UPDATE packages SET
      grp = CASE WHEN ${"grp" in b} THEN ${str(b.grp, 40) ?? "services"} ELSE grp END,
      category = CASE WHEN ${"category" in b} THEN ${str(b.category, 80)} ELSE category END,
      name = CASE WHEN ${"name" in b} THEN ${str(b.name, 120) ?? ""} ELSE name END,
      price = CASE WHEN ${"price" in b} THEN ${num(b.price)} ELSE price END,
      currency = CASE WHEN ${"currency" in b} THEN ${str(b.currency, 8) ?? "EUR"} ELSE currency END,
      unit = CASE WHEN ${"unit" in b} THEN ${str(b.unit, 40)} ELSE unit END,
      description = CASE WHEN ${"description" in b} THEN ${str(b.description, 600)} ELSE description END,
      features = CASE WHEN ${"features" in b} THEN ${"features" in b ? parseFeatures(b.features) : []} ELSE features END,
      highlighted = CASE WHEN ${"highlighted" in b} THEN ${Boolean(b.highlighted)} ELSE highlighted END,
      cta_label = CASE WHEN ${"cta_label" in b} THEN ${str(b.cta_label, 40)} ELSE cta_label END,
      cta_href = CASE WHEN ${"cta_href" in b} THEN ${str(b.cta_href, 300)} ELSE cta_href END,
      sort = CASE WHEN ${"sort" in b} THEN ${Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0} ELSE sort END,
      active = CASE WHEN ${"active" in b} THEN ${Boolean(b.active)} ELSE active END,
      updated_at = now()
    WHERE id = ${id}
  `;
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM packages WHERE id = ${id}`;
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

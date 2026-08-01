import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/i18n/revalidate";
import { getSql } from "@/lib/db";
import { getAllPackages } from "@/lib/packages";
import { groupFlow, packageSlug } from "@/lib/package-groups";

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

/**
 * A checkout slug nothing else is already using.
 *
 * `packages.slug` is uniquely indexed, so two packages named the same thing on
 * the same rail — "Održavanje" under Web & Aplikacije, added twice — would fail
 * the insert outright. Suffixing keeps the panel usable; the studio never sees
 * or types this value.
 */
async function freeSlug(grp: string, name: string, excludeId?: number): Promise<string> {
  const sql = getSql();
  const base = packageSlug(grp, name) || "paket";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = (await sql`
      SELECT 1 FROM packages
      WHERE slug = ${candidate} AND id IS DISTINCT FROM ${excludeId ?? null}
      LIMIT 1
    `) as unknown[];
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
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

  // Flow and slug are derived, never posted. Without them a package created in
  // the panel rendered a card whose button pointed at "#booking" — see
  // lib/package-groups.ts. The rail the studio clicked "Novi paket" under is
  // the only thing that decides which form the card opens.
  const grp = str(b.grp, 40) ?? "services";
  const sql = getSql();
  const [row] = (await sql`
    INSERT INTO packages (grp, category, name, price, currency, unit, description, features, highlighted, cta_label, cta_href, sort, active,
                          slug, flow,
                          name_en, category_en, unit_en, description_en, cta_label_en, features_en)
    VALUES (
      ${grp}, ${str(b.category, 80)}, ${name}, ${num(b.price)},
      ${str(b.currency, 8) ?? "EUR"}, ${str(b.unit, 40)}, ${str(b.description, 600)},
      ${parseFeatures(b.features)}, ${Boolean(b.highlighted)}, ${str(b.cta_label, 40)},
      ${str(b.cta_href, 300)}, ${Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0},
      ${b.active === undefined ? true : Boolean(b.active)},
      ${await freeSlug(grp, name)}, ${groupFlow(grp)},
      ${str(b.name_en, 120)}, ${str(b.category_en, 80)}, ${str(b.unit_en, 40)},
      ${str(b.description_en, 600)}, ${str(b.cta_label_en, 40)}, ${parseFeatures(b.features_en)}
    )
    RETURNING id
  `) as { id: number }[];
  revalidatePublic("/");
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

  // Keep the derived columns honest. `flow` follows the rail, because moving a
  // package between rails is exactly how the studio changes what its button
  // does. `slug` is only ever filled in when missing — it is a public URL, and
  // rewriting it because someone fixed a typo in the name would break every
  // link already shared for that package.
  const [current] = (await sql`
    SELECT grp, name, slug FROM packages WHERE id = ${id} LIMIT 1
  `) as { grp: string; name: string; slug: string | null }[];
  if (!current) {
    return NextResponse.json({ ok: false, message: "Paket ne postoji." }, { status: 404 });
  }
  const nextGrp = "grp" in b ? (str(b.grp, 40) ?? "services") : current.grp;
  const nextName = "name" in b ? (str(b.name, 120) ?? current.name) : current.name;
  const slug = current.slug ?? (await freeSlug(nextGrp, nextName, id));
  await sql`
    UPDATE packages SET slug = ${slug}, flow = ${groupFlow(nextGrp)} WHERE id = ${id}
  `;

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
      name_en = CASE WHEN ${"name_en" in b} THEN ${str(b.name_en, 120)} ELSE name_en END,
      category_en = CASE WHEN ${"category_en" in b} THEN ${str(b.category_en, 80)} ELSE category_en END,
      unit_en = CASE WHEN ${"unit_en" in b} THEN ${str(b.unit_en, 40)} ELSE unit_en END,
      description_en = CASE WHEN ${"description_en" in b} THEN ${str(b.description_en, 600)} ELSE description_en END,
      cta_label_en = CASE WHEN ${"cta_label_en" in b} THEN ${str(b.cta_label_en, 40)} ELSE cta_label_en END,
      features_en = CASE WHEN ${"features_en" in b} THEN ${"features_en" in b ? parseFeatures(b.features_en) : []} ELSE features_en END,
      updated_at = now()
    WHERE id = ${id}
  `;
  revalidatePublic("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, message: "Bad id" }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM packages WHERE id = ${id}`;
  revalidatePublic("/");
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";
import { getLandingOverrides } from "@/lib/content/landing.server";
import { DEFAULTS, TEXT_FIELDS, type LandingContent } from "@/lib/content/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editable landing copy, stored as one JSONB row under key 'landing'. The public
// site merges these over its defaults (lib/content/landing.ts).
//
// The editor is handed the RAW overrides plus the defaults, not the merged
// result: a field the studio has never touched shows up empty with the default
// as its placeholder, so "revert to default" is just clearing the box.

export async function GET() {
  return NextResponse.json({
    ok: true,
    content: await getLandingOverrides(),
    defaults: DEFAULTS,
  });
}

/** Only keys in the schema are persisted, and only in their declared shape.
 *  An empty value is dropped rather than stored — that is what makes clearing a
 *  field fall back to the default instead of blanking the section. */
function sanitize(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of TEXT_FIELDS) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 2000);
  }

  for (const key of ["strip_items", "education_pills"] as const) {
    const value = values[key];
    if (!Array.isArray(value)) continue;
    const items = value
      .map((item) => (typeof item === "string" ? item.trim().slice(0, 200) : ""))
      .filter(Boolean)
      .slice(0, 24);
    if (items.length > 0) out[key] = items;
  }

  if (Array.isArray(values.stats)) {
    const stats = values.stats
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const row = item as Record<string, unknown>;
        const value = typeof row.value === "string" ? row.value.trim().slice(0, 40) : "";
        const label = typeof row.label === "string" ? row.label.trim().slice(0, 80) : "";
        return value && label ? { value, label } : null;
      })
      .filter((item): item is LandingContent["stats"][number] => item !== null)
      .slice(0, 8);
    if (stats.length > 0) out.stats = stats;
  }

  return out;
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

  const values = sanitize(body.values as Record<string, unknown>);
  const sql = getSql();
  await sql`
    INSERT INTO site_content (key, value, updated_at)
    VALUES ('landing', ${JSON.stringify(values)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;

  // The landing is ISR (revalidate = 60). Without this an edit sits invisible
  // for up to a minute and the studio saves again thinking it failed.
  revalidatePath("/");

  return NextResponse.json({ ok: true, values });
}

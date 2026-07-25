import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "name", "logo_url", "currency", "locale", "phone", "email", "address", "city",
  "company_name", "pib", "mb", "bank_account", "instagram", "tiktok", "youtube", "linkedin",
] as const;
type Field = (typeof FIELDS)[number];

export async function GET() {
  const sql = getSql();
  const rows = (await sql`
    SELECT name, logo_url, currency, locale, phone, email, address, city,
           company_name, pib, mb, bank_account, instagram, tiktok, youtube, linkedin
    FROM studio_settings WHERE id = 1
  `) as Record<string, string | null>[];
  return NextResponse.json({ ok: true, settings: rows[0] ?? null });
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const v: Partial<Record<Field, string | null>> = {};
  for (const f of FIELDS) {
    if (f in body) {
      const raw = body[f];
      v[f] = typeof raw === "string" ? raw.trim().slice(0, 300) || null : null;
    }
  }
  const sql = getSql();
  await sql`
    UPDATE studio_settings SET
      name = CASE WHEN ${"name" in v} THEN ${v.name ?? null} ELSE name END,
      logo_url = CASE WHEN ${"logo_url" in v} THEN ${v.logo_url ?? null} ELSE logo_url END,
      currency = CASE WHEN ${"currency" in v} THEN COALESCE(${v.currency ?? null}, 'EUR') ELSE currency END,
      locale = CASE WHEN ${"locale" in v} THEN COALESCE(${v.locale ?? null}, 'sr') ELSE locale END,
      phone = CASE WHEN ${"phone" in v} THEN ${v.phone ?? null} ELSE phone END,
      email = CASE WHEN ${"email" in v} THEN ${v.email ?? null} ELSE email END,
      address = CASE WHEN ${"address" in v} THEN ${v.address ?? null} ELSE address END,
      city = CASE WHEN ${"city" in v} THEN ${v.city ?? null} ELSE city END,
      company_name = CASE WHEN ${"company_name" in v} THEN ${v.company_name ?? null} ELSE company_name END,
      pib = CASE WHEN ${"pib" in v} THEN ${v.pib ?? null} ELSE pib END,
      mb = CASE WHEN ${"mb" in v} THEN ${v.mb ?? null} ELSE mb END,
      bank_account = CASE WHEN ${"bank_account" in v} THEN ${v.bank_account ?? null} ELSE bank_account END,
      instagram = CASE WHEN ${"instagram" in v} THEN ${v.instagram ?? null} ELSE instagram END,
      tiktok = CASE WHEN ${"tiktok" in v} THEN ${v.tiktok ?? null} ELSE tiktok END,
      youtube = CASE WHEN ${"youtube" in v} THEN ${v.youtube ?? null} ELSE youtube END,
      linkedin = CASE WHEN ${"linkedin" in v} THEN ${v.linkedin ?? null} ELSE linkedin END,
      updated_at = now()
    WHERE id = 1
  `;
  return NextResponse.json({ ok: true });
}

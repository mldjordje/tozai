import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/i18n/revalidate";
import { getSql } from "@/lib/db";
import { cleanSocialLinks } from "@/lib/socials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "name", "logo_url", "currency", "locale", "phone", "email", "notify_email", "address", "city",
  "company_name", "pib", "mb", "bank_account", "instagram", "tiktok", "youtube", "linkedin",
  "iban", "swift", "bank_name", "bank_address", "vat_note_domestic", "vat_note_foreign",
  "invoice_due_days",
  "activity_code", "registration_number",
] as const;
type Field = (typeof FIELDS)[number];

export async function GET() {
  const sql = getSql();
  const rows = (await sql`
    SELECT name, logo_url, currency, locale, phone, email, notify_email, address, city,
           company_name, pib, mb, bank_account, instagram, tiktok, youtube, linkedin
           , iban, swift, bank_name, bank_address, vat_note_domestic, vat_note_foreign,
           invoice_due_days::text AS invoice_due_days
           , activity_code, registration_number, social_links
    FROM studio_settings WHERE id = 1
  `) as Record<string, unknown>[];
  const row = rows[0] ?? null;
  return NextResponse.json({
    ok: true,
    settings: row,
    socials: row ? cleanSocialLinks(row.social_links) : [],
  });
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
  const dueDays =
    "invoice_due_days" in v && v.invoice_due_days !== null
      ? Number(v.invoice_due_days)
      : null;
  if (
    "invoice_due_days" in v &&
    (!Number.isInteger(dueDays) || dueDays === null || dueDays < 0 || dueDays > 90)
  ) {
    return NextResponse.json(
      { ok: false, message: "Rok plaćanja mora biti ceo broj od 0 do 90." },
      { status: 400 },
    );
  }
  // Half-filled rows are dropped rather than rejected: the studio adds an empty
  // row, tabs away, and should not be blocked by a validation error over a line
  // it never meant to keep.
  const socials = cleanSocialLinks(body.socials);

  const sql = getSql();
  await sql`
    UPDATE studio_settings SET
      name = CASE WHEN ${"name" in v} THEN ${v.name ?? null} ELSE name END,
      logo_url = CASE WHEN ${"logo_url" in v} THEN ${v.logo_url ?? null} ELSE logo_url END,
      currency = CASE WHEN ${"currency" in v} THEN COALESCE(${v.currency ?? null}, 'EUR') ELSE currency END,
      locale = CASE WHEN ${"locale" in v} THEN COALESCE(${v.locale ?? null}, 'sr') ELSE locale END,
      phone = CASE WHEN ${"phone" in v} THEN ${v.phone ?? null} ELSE phone END,
      email = CASE WHEN ${"email" in v} THEN ${v.email ?? null} ELSE email END,
      notify_email = CASE WHEN ${"notify_email" in v} THEN ${v.notify_email ?? null} ELSE notify_email END,
      address = CASE WHEN ${"address" in v} THEN ${v.address ?? null} ELSE address END,
      city = CASE WHEN ${"city" in v} THEN ${v.city ?? null} ELSE city END,
      company_name = CASE WHEN ${"company_name" in v} THEN ${v.company_name ?? null} ELSE company_name END,
      pib = CASE WHEN ${"pib" in v} THEN ${v.pib ?? null} ELSE pib END,
      mb = CASE WHEN ${"mb" in v} THEN ${v.mb ?? null} ELSE mb END,
      bank_account = CASE WHEN ${"bank_account" in v} THEN ${v.bank_account ?? null} ELSE bank_account END,
      activity_code = CASE WHEN ${"activity_code" in v} THEN ${v.activity_code ?? null} ELSE activity_code END,
      registration_number = CASE WHEN ${"registration_number" in v} THEN ${v.registration_number ?? null} ELSE registration_number END,
      iban = CASE WHEN ${"iban" in v} THEN ${v.iban ?? null} ELSE iban END,
      swift = CASE WHEN ${"swift" in v} THEN ${v.swift ?? null} ELSE swift END,
      bank_name = CASE WHEN ${"bank_name" in v} THEN ${v.bank_name ?? null} ELSE bank_name END,
      bank_address = CASE WHEN ${"bank_address" in v} THEN ${v.bank_address ?? null} ELSE bank_address END,
      vat_note_domestic = CASE WHEN ${"vat_note_domestic" in v} THEN ${v.vat_note_domestic ?? null} ELSE vat_note_domestic END,
      vat_note_foreign = CASE WHEN ${"vat_note_foreign" in v} THEN ${v.vat_note_foreign ?? null} ELSE vat_note_foreign END,
      invoice_due_days = CASE
        WHEN ${"invoice_due_days" in v}
        THEN ${dueDays ?? 5}
        ELSE invoice_due_days
      END,
      instagram = CASE WHEN ${"instagram" in v} THEN ${v.instagram ?? null} ELSE instagram END,
      tiktok = CASE WHEN ${"tiktok" in v} THEN ${v.tiktok ?? null} ELSE tiktok END,
      youtube = CASE WHEN ${"youtube" in v} THEN ${v.youtube ?? null} ELSE youtube END,
      linkedin = CASE WHEN ${"linkedin" in v} THEN ${v.linkedin ?? null} ELSE linkedin END,
      social_links = CASE
        WHEN ${"socials" in body}
        THEN ${JSON.stringify(socials)}::jsonb
        ELSE social_links
      END,
      updated_at = now()
    WHERE id = 1
  `;

  // Contact details and the icon row are rendered on the ISR landing and the
  // portfolio page; without this an edit sits invisible until the window ends.
  revalidatePublic("/");
  revalidatePublic("/portfolio");

  return NextResponse.json({ ok: true, socials });
}

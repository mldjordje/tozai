import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";

export const runtime = "nodejs";

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

// Billing details the customer maintains themselves. This is the *profile*;
// checkout snapshots it into orders.billing so a later edit never rewrites an
// already-issued invoice.
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const isCompany = body.is_company === true;
  const name = text(body.name, 120);
  const phone = text(body.phone, 40);
  const address = text(body.address, 200);
  const city = text(body.city, 80);
  const companyName = isCompany ? text(body.company_name, 160) : null;
  const pib = isCompany ? text(body.pib, 20) : null;
  const mb = isCompany ? text(body.mb, 20) : null;

  if (isCompany) {
    if (!companyName) {
      return NextResponse.json(
        { ok: false, message: "Naziv firme je obavezan za pravno lice." },
        { status: 400 },
      );
    }
    if (!pib || !/^\d{9}$/.test(pib)) {
      return NextResponse.json(
        { ok: false, message: "PIB mora imati tačno 9 cifara." },
        { status: 400 },
      );
    }
    if (!mb || !/^\d{8}$/.test(mb)) {
      return NextResponse.json(
        { ok: false, message: "Matični broj mora imati tačno 8 cifara." },
        { status: 400 },
      );
    }
  }

  const sql = getSql();
  await sql`
    UPDATE users
    SET name = ${name}, phone = ${phone}, address = ${address}, city = ${city},
        is_company = ${isCompany}, company_name = ${companyName},
        pib = ${pib}, mb = ${mb}
    WHERE id = ${user.uid}
  `;

  return NextResponse.json({ ok: true });
}

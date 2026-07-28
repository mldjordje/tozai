import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/payments/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Record a package the client paid for in cash, and give them everything the
// purchase carries.
//
// It deliberately does NOT shortcut into `hour_entries` or `projects`: it
// writes a real order marked paid and then runs the same `fulfillPaidOrder()`
// the card flow and the "označi kao plaćeno" button run. That is what keeps a
// cash sale in the books — it gets an invoice with a proper number, it shows up
// in the client's order history and in analytics, and the buyer gets the same
// confirmation mail. A hand-rolled wallet top-up would produce hours with no
// paper trail behind them.
//
// `payment_method = 'cash'` is server-side only: the checkout can never select
// it (see lib/payments/selection.ts), so no buyer can mark their own order paid.

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  is_company: boolean;
  company_name: string | null;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

type PackageRow = {
  id: number;
  name: string;
  price: number | null;
  currency: string;
  grp: string;
  flow: string;
  hours: number | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number((await params).id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, message: "Neispravan klijent." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const packageId = Number(body.packageId);
  if (!Number.isInteger(packageId)) {
    return NextResponse.json({ ok: false, message: "Paket nije izabran." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) || null : null;

  const sql = getSql();
  const users = (await sql`
    SELECT id, email, name, phone, is_company, company_name, pib, mb, address, city, country
    FROM users WHERE id = ${userId}
  `) as UserRow[];
  const user = users[0];
  if (!user) {
    return NextResponse.json({ ok: false, message: "Klijent nije pronađen." }, { status: 404 });
  }

  const packages = (await sql`
    SELECT id, name, price::float8 AS price, currency, grp, flow, hours::float8 AS hours
    FROM packages WHERE id = ${packageId}
  `) as PackageRow[];
  const pkg = packages[0];
  if (!pkg) {
    return NextResponse.json({ ok: false, message: "Paket nije pronađen." }, { status: 404 });
  }

  // The cenovnik price is the default; the studio can record what was actually
  // handed over (a rounded cash figure, a discount) because the invoice has to
  // match the money that changed hands, not the list price.
  const overrideRaw = body.amount;
  const amount =
    overrideRaw === undefined || overrideRaw === null || overrideRaw === ""
      ? pkg.price
      : Number(overrideRaw);
  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { ok: false, message: "Unesi iznos — paket nema objavljenu cenu." },
      { status: 400 },
    );
  }

  const kind = pkg.flow === "hours" ? (pkg.grp === "education" ? "education" : "consulting") : null;
  const billing = {
    name: user.name ?? "",
    phone: user.phone ?? "",
    isCompany: user.is_company,
    companyName: user.company_name ?? "",
    pib: user.pib ?? "",
    mb: user.mb ?? "",
    address: user.address ?? "",
    city: user.city ?? "",
    country: user.country ?? "",
    email: user.email,
  };

  const created = (await sql`
    INSERT INTO orders (user_id, package_id, item, amount, currency, status, flow, kind, hours,
                        buyer_type, billing, payment_method, provider, note)
    VALUES (${userId}, ${pkg.id}, ${pkg.name}, ${amount}, ${pkg.currency}, 'pending',
            ${pkg.flow}, ${kind}, ${pkg.hours},
            ${user.is_company ? "company" : "individual"},
            ${JSON.stringify(billing)}::jsonb, 'cash', 'cash',
            ${note ?? "Plaćeno kešom (uneto iz admina)."})
    RETURNING id
  `) as { id: number }[];
  const orderId = created[0]?.id;
  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Porudžbina nije sačuvana." }, { status: 500 });
  }

  const result = await fulfillPaidOrder(orderId, {
    provider: "cash",
    providerRef: note ?? `KES-${orderId}`,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
  });

  return NextResponse.json({ ...result, ok: true, orderId, item: pkg.name, amount });
}

import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { getPackageBySlug } from "@/lib/packages";
import { getPaymentProvider } from "@/lib/payments/provider";

// Create a pending order and hand back a payment intent.
//
// Gated by middleware (/api/nalog/*), so a session is guaranteed — but it is
// re-read here rather than trusted from the body, because the buyer must be the
// session owner and nothing else.
//
// PRICE IS NEVER TAKEN FROM THE CLIENT. Only the slug comes from the request;
// amount, currency, flow and hours are read from the packages row server-side.

type Billing = {
  name: string;
  phone: string;
  isCompany: boolean;
  companyName?: string;
  pib?: string;
  mb?: string;
  address?: string;
  city?: string;
};

function clean(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const slug = clean(body.slug, 120);
  if (!slug) {
    return NextResponse.json({ ok: false, message: "Paket nije izabran." }, { status: 400 });
  }

  const pkg = await getPackageBySlug(slug);
  if (!pkg) {
    return NextResponse.json({ ok: false, message: "Paket nije pronađen." }, { status: 404 });
  }
  if (pkg.price == null || pkg.price <= 0) {
    // Placeholder pricing ("€—") must not become a zero-value order.
    return NextResponse.json(
      { ok: false, message: "Cena za ovaj paket još nije objavljena. Javi nam se za ponudu." },
      { status: 409 },
    );
  }

  const isCompany = body.isCompany === true;
  const billing: Billing = {
    name: clean(body.name, 120),
    phone: clean(body.phone, 40),
    isCompany,
    companyName: clean(body.companyName, 160),
    pib: clean(body.pib, 20),
    mb: clean(body.mb, 20),
    address: clean(body.address, 200),
    city: clean(body.city, 120),
  };

  if (!billing.name) {
    return NextResponse.json({ ok: false, message: "Ime i prezime su obavezni." }, { status: 400 });
  }
  if (isCompany) {
    const missing = (["companyName", "pib", "mb", "address", "city"] as const).filter(
      (k) => !billing[k],
    );
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Za pravno lice su obavezni naziv, PIB, MB, adresa i grad." },
        { status: 400 },
      );
    }
    // PIB is 9 digits, MB is 8 — a wrong one makes the invoice unusable, and
    // it is far cheaper to reject it here than to reissue later.
    if (!/^\d{9}$/.test(billing.pib!)) {
      return NextResponse.json({ ok: false, message: "PIB mora imati 9 cifara." }, { status: 400 });
    }
    if (!/^\d{8}$/.test(billing.mb!)) {
      return NextResponse.json({ ok: false, message: "Matični broj mora imati 8 cifara." }, { status: 400 });
    }
  }

  const sql = getSql();

  // Keep the profile current, then snapshot into the order. The snapshot is the
  // point: editing your profile next month must not rewrite an issued invoice.
  await sql`
    UPDATE users
    SET name = COALESCE(NULLIF(${billing.name}, ''), name),
        phone = COALESCE(NULLIF(${billing.phone}, ''), phone),
        is_company = ${isCompany},
        company_name = NULLIF(${billing.companyName ?? ""}, ''),
        pib = NULLIF(${billing.pib ?? ""}, ''),
        mb = NULLIF(${billing.mb ?? ""}, ''),
        address = NULLIF(${billing.address ?? ""}, ''),
        city = NULLIF(${billing.city ?? ""}, '')
    WHERE id = ${user.uid}
  `;

  const kind = pkg.flow === "hours" ? (pkg.grp === "education" ? "education" : "consulting") : null;

  const rows = (await sql`
    INSERT INTO orders (user_id, package_id, item, amount, currency, status, flow, kind, hours,
                        buyer_type, billing)
    VALUES (${user.uid}, ${pkg.id}, ${pkg.name}, ${pkg.price}, ${pkg.currency}, 'pending',
            ${pkg.flow}, ${kind}, ${pkg.hours}, ${isCompany ? "company" : "individual"},
            ${JSON.stringify({ ...billing, email: user.email })}::jsonb)
    RETURNING id
  `) as { id: number }[];

  const orderId = rows[0]?.id;
  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Porudžbina nije sačuvana." }, { status: 500 });
  }

  const provider = await getPaymentProvider();
  let intent;
  try {
    intent = await provider.createCheckout({
      id: orderId,
      item: pkg.name,
      amount: pkg.price,
      currency: pkg.currency,
      buyerEmail: user.email,
    });
  } catch (error) {
    // The order is already recorded, so the buyer is not lost — surface the
    // failure instead of pretending the purchase did not happen.
    console.error("[porudzbina] payment provider failed", error);
    return NextResponse.json(
      { ok: false, orderId, message: "Plaćanje trenutno nije dostupno. Javićemo ti se sa predračunom." },
      { status: 502 },
    );
  }

  await sql`UPDATE orders SET provider = ${provider.id} WHERE id = ${orderId}`;

  return NextResponse.json({ ok: true, orderId, flow: pkg.flow, intent });
}

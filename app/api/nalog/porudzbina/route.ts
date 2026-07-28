import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { isSerbia } from "@/lib/countries";
import { getPackageBySlug } from "@/lib/packages";
import { getProviderFor, normalizePaymentMethod } from "@/lib/payments/provider";
import { issueInvoice, renderStoredInvoice } from "@/lib/invoices/issue";
import { queueQuietly, queueStudioNotice } from "@/lib/email";

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
  /** ISO-ish country, as typed. Decides which invoice template the buyer gets:
   *  Serbia (or blank) is domestic, anything else the English/EUR document. */
  country?: string;
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

  // The method is validated against what is actually wired up, never trusted:
  // a client claiming "card" while no provider exists would otherwise reach a
  // dead payment page with a pending order behind it.
  const method = normalizePaymentMethod(body.paymentMethod);
  if (!method) {
    return NextResponse.json(
      { ok: false, message: "Izabrani način plaćanja trenutno nije dostupan." },
      { status: 400 },
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
    country: clean(body.country, 80),
  };

  if (!billing.name) {
    return NextResponse.json({ ok: false, message: "Ime i prezime su obavezni." }, { status: 400 });
  }
  if (isCompany) {
    const missing = (["companyName", "address", "city"] as const).filter((k) => !billing[k]);
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Za pravno lice su obavezni naziv, adresa i grad." },
        { status: 400 },
      );
    }
    // PIB is 9 digits, MB is 8 — a wrong one makes the invoice unusable, and
    // it is far cheaper to reject it here than to reissue later. Both are
    // Serbian register numbers, so they are only asked of a Serbian company; a
    // buyer elsewhere gives one free-form tax ID, which the foreign template
    // prints under "Tax ID".
    if (isSerbia(billing.country)) {
      if (!/^\d{9}$/.test(billing.pib ?? "")) {
        return NextResponse.json({ ok: false, message: "PIB mora imati 9 cifara." }, { status: 400 });
      }
      if (!/^\d{8}$/.test(billing.mb ?? "")) {
        return NextResponse.json({ ok: false, message: "Matični broj mora imati 8 cifara." }, { status: 400 });
      }
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
        city = NULLIF(${billing.city ?? ""}, ''),
        country = COALESCE(NULLIF(${billing.country ?? ""}, ''), country)
    WHERE id = ${user.uid}
  `;

  const kind = pkg.flow === "hours" ? (pkg.grp === "education" ? "education" : "consulting") : null;

  const rows = (await sql`
    INSERT INTO orders (user_id, package_id, item, amount, currency, status, flow, kind, hours,
                        buyer_type, billing, payment_method)
    VALUES (${user.uid}, ${pkg.id}, ${pkg.name}, ${pkg.price}, ${pkg.currency}, 'pending',
            ${pkg.flow}, ${kind}, ${pkg.hours}, ${isCompany ? "company" : "individual"},
            ${JSON.stringify({ ...billing, email: user.email })}::jsonb, ${method})
    RETURNING id
  `) as { id: number }[];

  const orderId = rows[0]?.id;
  if (!orderId) {
    return NextResponse.json({ ok: false, message: "Porudžbina nije sačuvana." }, { status: 500 });
  }

  const provider = await getProviderFor(method);
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const total = `${pkg.price.toLocaleString("sr-RS")} ${pkg.currency}`;

  // On bank transfer the buyer has to carry a reference number away from the
  // screen. Repeating the slip in mail is the difference between a payment that
  // reconciles itself and one the studio has to chase.
  // null drops the line; "" is a deliberate blank line between paragraphs.
  const lines = (parts: (string | null)[]) =>
    parts.filter((line): line is string => line !== null).join("\n");

  // Bank transfer gets a numbered proforma right away — that is the document
  // the buyer pays against, and a company buyer cannot get the payment approved
  // internally without one. The final invoice waits for the money to land
  // (income is recorded on receipt), and is issued by fulfillPaidOrder().
  //
  // A failure here must not fail the order: the payment slip is already on
  // screen and in the mail, and the proforma can be reissued from the admin.
  let proforma = null;
  let proformaAttachment: { filename: string; content: string } | undefined;
  if (method === "invoice") {
    try {
      proforma = await issueInvoice(orderId, "proforma");
      if (proforma) {
        const rendered = await renderStoredInvoice(proforma.id);
        if (rendered) {
          proformaAttachment = {
            filename: `${rendered.number}.pdf`,
            content: Buffer.from(rendered.bytes).toString("base64"),
          };
        }
      }
    } catch (error) {
      console.error("[porudzbina] proforma issue failed", orderId, error);
    }
  }

  const payment =
    intent.kind === "manual"
      ? [
          "Podaci za uplatu:",
          `Iznos: ${total}`,
          `Poziv na broj: ${intent.reference}`,
          intent.payee.name ? `Primalac: ${intent.payee.name}` : null,
          intent.payee.account ? `Račun: ${intent.payee.account}` : null,
          proforma ? `Predračun: ${proforma.number}` : null,
          "",
          "Predračun i sve podatke za uplatu imaš i na svom nalogu:",
          `${baseUrl}/nalog/fakture`,
          "",
          "Čim uplata legne, potvrdićemo je i sve postaje dostupno na nalogu.",
        ]
      : ["Plaćanje se završava u koraku koji ti je otvoren na sajtu."];

  await queueQuietly({
    userId: user.uid,
    recipient: user.email,
    templateKey: proforma ? "proforma_issued" : "order_created",
    subject: proforma
      ? `Predračun ${proforma.number} — ${pkg.name}`
      : `Porudžbina #${orderId} — ${pkg.name}`,
    body: lines([
      `Zdravo ${billing.name.split(" ")[0]},`,
      "",
      `Primili smo porudžbinu: ${pkg.name} — ${total}.`,
      pkg.flow === "hours" && pkg.hours
        ? `Nakon potvrde uplate dobijaš ${pkg.hours} ${Number(pkg.hours) === 1 ? "sat" : "sati"} na svom nalogu.`
        : null,
      "",
      ...payment,
      "",
      "Status porudžbine:",
      `${baseUrl}/nalog/porudzbine`,
      "",
      "TOZA AI",
    ]),
    attachments: proformaAttachment ? [proformaAttachment] : undefined,
  });

  await queueStudioNotice({
    templateKey: "studio_new_order",
    subject: `Nova porudžbina #${orderId} — ${total}`,
    body: lines([
      `${billing.name} (${user.email}) je naručio: ${pkg.name}.`,
      `Iznos: ${total}`,
      `Način plaćanja: ${method === "invoice" ? "faktura / uplata na račun" : "kartica"} (${provider.id})`,
      intent.kind === "manual" ? `Poziv na broj: ${intent.reference}` : null,
      proforma ? `Predračun: ${proforma.number}` : null,
      "",
      `Potvrdi uplatu: ${baseUrl}/admin/porudzbine`,
    ]),
  });

  return NextResponse.json({
    ok: true,
    orderId,
    flow: pkg.flow,
    intent,
    proforma: proforma ? { id: proforma.id, number: proforma.number } : null,
  });
}

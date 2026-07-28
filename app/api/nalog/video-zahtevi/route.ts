import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { getPackageBySlug } from "@/lib/packages";
import { defaultPaymentMethod, getProviderFor } from "@/lib/payments/provider";
import { issueInvoice } from "@/lib/invoices/issue";
import { queueQuietly, queueStudioNotice } from "@/lib/email";
import {
  cleanText,
  getUserVideoRequests,
  type VideoRequestBrief,
} from "@/lib/video-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OPEN_REQUESTS = 5;

type BillingSnapshot = {
  name: string;
  phone: string;
  isCompany: boolean;
  companyName: string;
  pib: string;
  mb: string;
  address: string;
  city: string;
  email: string;
};

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, requests: await getUserVideoRequests(user.uid) });
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

  const slug = cleanText(body.slug, 120, 1);
  const buyerType = body.buyerType === "company" ? "company" : body.buyerType === "individual" ? "individual" : null;
  // Minimums are mirrored in VideoInquiryFlow (MIN) so the hint text, the live
  // counter and this check agree. A two-word "idea" cannot be quoted from.
  const idea = cleanText(body.idea, 4000, 50);
  const businessName = cleanText(body.businessName, 160, 2);
  const businessDescription = cleanText(body.businessDescription, 2000, 30);
  const clipCount = Number(body.clipCount);
  const budgetEur = Number(body.budgetEur);
  const name = cleanText(body.name, 120, 2) ?? "";
  const phone = cleanText(body.phone, 40) ?? "";
  const isCompany = buyerType === "company";
  const companyName = cleanText(body.companyName, 160) ?? "";
  const pib = cleanText(body.pib, 20) ?? "";
  const mb = cleanText(body.mb, 20) ?? "";
  const address = cleanText(body.address, 200) ?? "";
  const city = cleanText(body.city, 120) ?? "";
  if (
    !slug || !buyerType || !name || !idea || !businessName || !businessDescription ||
    !Number.isInteger(clipCount) || clipCount < 1 || clipCount > 100 ||
    !Number.isFinite(budgetEur) || budgetEur <= 0 || budgetEur > 1_000_000
  ) {
    return NextResponse.json(
      { ok: false, message: "Popuni sva polja. Broj klipova i budžet moraju biti veći od nule." },
      { status: 400 },
    );
  }
  if (
    isCompany &&
    (!companyName || !/^\d{9}$/.test(pib) || !/^\d{8}$/.test(mb) || !address || !city)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Za pravno lice su obavezni pun naziv, PIB (9 cifara), matični broj (8 cifara), adresa i grad.",
      },
      { status: 400 },
    );
  }

  const pkg = await getPackageBySlug(slug);
  if (!pkg || pkg.flow !== "project") {
    return NextResponse.json({ ok: false, message: "AI video usluga nije pronađena." }, { status: 404 });
  }

  const brief: VideoRequestBrief = { idea };
  const projectTitle = `${businessName} — ${pkg.name}`;
  const billing: BillingSnapshot = {
    name,
    phone,
    isCompany,
    companyName,
    pib,
    mb,
    address,
    city,
    email: user.email,
  };

  const sql = getSql();
  const open = (await sql`
    SELECT count(*)::int AS count
    FROM video_requests
    WHERE user_id = ${user.uid} AND status IN ('submitted', 'quoted')
  `) as { count: number }[];
  if ((open[0]?.count ?? 0) >= MAX_OPEN_REQUESTS) {
    return NextResponse.json(
      { ok: false, message: "Već imaš više aktivnih zahteva. Sačekaj odgovor pre novog briefa." },
      { status: 409 },
    );
  }

  await sql`
    UPDATE users
    SET name = ${name},
        phone = NULLIF(${phone}, ''),
        is_company = ${isCompany},
        company_name = NULLIF(${isCompany ? companyName : ""}, ''),
        pib = NULLIF(${isCompany ? pib : ""}, ''),
        mb = NULLIF(${isCompany ? mb : ""}, ''),
        address = NULLIF(${isCompany ? address : ""}, ''),
        city = NULLIF(${isCompany ? city : ""}, '')
    WHERE id = ${user.uid}
  `;

  const rows = (await sql`
    INSERT INTO video_requests (
      user_id, package_id, service_name, project_title, brief, buyer_type,
      clip_count, business_name, business_description, budget_eur, currency, revisions,
      billing
    )
    VALUES (
      ${user.uid}, ${pkg.id}, ${pkg.name}, ${projectTitle},
      ${JSON.stringify(brief)}::jsonb, ${buyerType}, ${clipCount}, ${businessName},
      ${businessDescription}, ${budgetEur}, ${pkg.currency}, ${pkg.revisions},
      ${JSON.stringify(billing)}::jsonb
    )
    RETURNING id
  `) as { id: number }[];

  const requestId = rows[0].id;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  // The buyer just handed over a brief and got a screen that says "we'll be in
  // touch" — with nothing in their inbox, that promise lives only in a tab they
  // are about to close.
  await queueQuietly({
    userId: user.uid,
    recipient: user.email,
    templateKey: "inquiry_received",
    subject: `Upit #${requestId} je stigao — ${pkg.name}`,
    body: [
      `Zdravo ${name.split(" ")[0]},`,
      "",
      `Primili smo tvoj upit za ${pkg.name} (${clipCount} ${clipCount === 1 ? "klip" : "klipova"}).`,
      "",
      "Šta sledi:",
      "1. Pregledamo ideju, broj klipova i budžet.",
      "2. Cena i rok izrade stižu na tvoj nalog — javićemo ti mejlom.",
      "3. Tek tada odlučuješ da li prihvataš. Do tada te ništa ne obavezuje.",
      "",
      "Prati status upita:",
      `${baseUrl}/nalog/zahtevi`,
      "",
      "TOZA AI",
    ].join("\n"),
  });

  await queueStudioNotice({
    templateKey: "studio_new_inquiry",
    subject: `Novi upit #${requestId} — ${businessName}`,
    body: [
      `${name} (${user.email}) je poslao upit za ${pkg.name}.`,
      "",
      `Biznis: ${businessName}`,
      `Klipova: ${clipCount}`,
      `Budžet: ${budgetEur} EUR`,
      "",
      "Ideja:",
      idea,
      "",
      `Pošalji procenu: ${baseUrl}/admin/video-zahtevi`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, requestId }, { status: 201 });
}

export async function PATCH(request: Request) {
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

  const id = Number(body.id);
  const action = body.action;
  if (!Number.isInteger(id) || (action !== "accept" && action !== "decline" && action !== "withdraw")) {
    return NextResponse.json({ ok: false, message: "Neispravna akcija." }, { status: 400 });
  }

  const sql = getSql();
  if (action === "decline" || action === "withdraw") {
    const allowed = action === "decline" ? "quoted" : "submitted";
    const nextStatus = action === "decline" ? "declined" : "canceled";
    const changed = (await sql`
      UPDATE video_requests
      SET status = ${nextStatus}, responded_at = now(), updated_at = now()
      WHERE id = ${id} AND user_id = ${user.uid} AND status = ${allowed}
      RETURNING id
    `) as { id: number }[];
    if (changed.length === 0) {
      return NextResponse.json({ ok: false, message: "Zahtev više nije moguće izmeniti." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const quote = (await sql`
    SELECT r.id, r.service_name, r.project_title, r.brief,
           r.quoted_amount::float8 AS quoted_amount, r.currency,
           r.package_id, r.revisions, r.turnaround_days, r.buyer_type,
           r.billing AS request_billing,
           r.quote_valid_until::text AS quote_valid_until,
           u.email, u.name, u.phone, u.is_company, u.company_name, u.pib, u.mb, u.address, u.city
    FROM video_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.id = ${id} AND r.user_id = ${user.uid} AND r.status = 'quoted'
    LIMIT 1
  `) as {
    id: number;
    service_name: string;
    project_title: string;
    brief: VideoRequestBrief;
    quoted_amount: number;
    currency: string;
    package_id: number | null;
    revisions: number;
    turnaround_days: number | null;
    buyer_type: "individual" | "company";
    request_billing: BillingSnapshot | null;
    quote_valid_until: string | null;
    email: string;
    name: string | null;
    phone: string | null;
    is_company: boolean;
    company_name: string | null;
    pib: string | null;
    mb: string | null;
    address: string | null;
    city: string | null;
  }[];
  const q = quote[0];
  if (!q) {
    return NextResponse.json({ ok: false, message: "Ponuda nije pronađena ili više nije aktivna." }, { status: 409 });
  }
  if (q.quote_valid_until && q.quote_valid_until < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ ok: false, message: "Ponuda je istekla. Zatraži novu procenu." }, { status: 409 });
  }

  const billing: BillingSnapshot = q.request_billing ?? {
    name: q.name ?? "",
    phone: q.phone ?? "",
    isCompany: q.buyer_type === "company",
    companyName: q.company_name ?? "",
    pib: q.pib ?? "",
    mb: q.mb ?? "",
    address: q.address ?? "",
    city: q.city ?? "",
    email: q.email,
  };
  if (
    billing.isCompany &&
    (!billing.companyName ||
      !/^\d{9}$/.test(billing.pib) ||
      !/^\d{8}$/.test(billing.mb) ||
      !billing.address ||
      !billing.city)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Pre plaćanja dopuni naziv firme, PIB, matični broj, adresu i grad u profilu.",
      },
      { status: 409 },
    );
  }

  // quote_request_id is unique. A retry after a network interruption reuses
  // the same order instead of creating a duplicate charge.
  const inserted = (await sql`
    INSERT INTO orders (
      user_id, package_id, item, amount, currency, status, flow, kind, hours,
      buyer_type, billing, quote_request_id, note, payment_method
    )
    VALUES (
      ${user.uid}, ${q.package_id}, ${q.service_name}, ${q.quoted_amount}, ${q.currency},
      'pending', 'project', NULL, NULL, ${q.buyer_type},
      ${JSON.stringify(billing)}::jsonb, ${q.id},
      ${q.turnaround_days ? `Dogovoreno vreme izrade: ${q.turnaround_days} dana` : null},
      ${defaultPaymentMethod()}
    )
    ON CONFLICT (quote_request_id) WHERE quote_request_id IS NOT NULL
      DO UPDATE SET quote_request_id = EXCLUDED.quote_request_id
    RETURNING id
  `) as { id: number }[];
  const orderId = inserted[0].id;

  await sql`
    UPDATE video_requests
    SET status = 'accepted', order_id = ${orderId}, responded_at = now(), updated_at = now()
    WHERE id = ${q.id} AND user_id = ${user.uid} AND status = 'quoted'
  `;

  const paymentMethod = defaultPaymentMethod();
  const provider = await getProviderFor(paymentMethod);
  const intent = await provider.createCheckout({
    id: orderId,
    item: q.service_name,
    amount: q.quoted_amount,
    currency: q.currency,
    buyerEmail: q.email,
    buyer: {
      name: billing.isCompany ? billing.companyName : billing.name,
      phone: billing.phone,
      address: billing.address,
      city: billing.city,
    },
  });
  if (paymentMethod === "invoice") {
    try {
      await issueInvoice(orderId, "proforma");
    } catch (error) {
      console.error("[video-zahtevi] proforma issue failed", orderId, error);
    }
  }
  await sql`UPDATE orders SET provider = ${provider.id} WHERE id = ${orderId}`;

  // Accepting a quote is the same event as placing an order, so it gets the
  // same slip — this is the branch where a project buyer actually owes money.
  const acceptBase = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const acceptTotal = `${q.quoted_amount.toLocaleString("sr-RS")} ${q.currency}`;
  await queueQuietly({
    userId: user.uid,
    recipient: q.email,
    templateKey: "order_created",
    subject: `Porudžbina #${orderId} — ${q.project_title}`,
    body: [
      `Zdravo ${(q.name ?? billing.name).split(" ")[0]},`,
      "",
      `Ponuda je prihvaćena: ${q.service_name} — ${acceptTotal}.`,
      ...(intent.kind === "manual"
        ? [
            "",
            "Podaci za uplatu:",
            `Poziv na broj: ${intent.reference}`,
            ...(intent.payee.name ? [`Primalac: ${intent.payee.name}`] : []),
            ...(intent.payee.account ? [`Račun: ${intent.payee.account}`] : []),
            "",
            "Čim uplata legne, otvaramo projekat i tražimo materijale.",
          ]
        : []),
      "",
      "Status porudžbine:",
      `${acceptBase}/nalog/porudzbine`,
      "",
      "TOZA AI",
    ].join("\n"),
  });

  await queueStudioNotice({
    templateKey: "studio_quote_accepted",
    subject: `Ponuda prihvaćena — porudžbina #${orderId} (${acceptTotal})`,
    body: [
      `${q.name ?? billing.name} (${q.email}) je prihvatio ponudu za ${q.project_title}.`,
      `Iznos: ${acceptTotal}`,
      "",
      `Potvrdi uplatu: ${acceptBase}/admin/porudzbine`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, orderId, intent });
}

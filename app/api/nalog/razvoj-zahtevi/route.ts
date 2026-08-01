import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { getPackageBySlug } from "@/lib/packages";
import { isSerbia } from "@/lib/countries";
import { queueQuietly, queueStudioNotice } from "@/lib/email";
import { cleanText } from "@/lib/video-requests";
import {
  TIMEFRAME_LABEL,
  isTimeframe,
  type BuildBrief,
} from "@/lib/build-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A web / app / automation brief.
 *
 * Writes into `video_requests` with kind='build' — see the note on that column
 * in scripts/init-db.mjs. Everything downstream (the studio's quote, accepting
 * it, the order and the project it becomes) is already built there and is
 * identical for both kinds of brief, so this route's whole job is validating a
 * different set of answers and storing them.
 *
 * THE TWO DIFFERENCES FROM THE VIDEO BRIEF, both deliberate:
 *   - Budget is optional. Someone asking for a web shop usually cannot estimate
 *     one, and a required number is how that brief gets abandoned rather than
 *     sent. NULL is a question for the first call.
 *   - `clip_count` is left at its column default and never read.
 */

const MAX_OPEN_REQUESTS = 5;

/** Mirrors MAX_SERVICES in BuildInquiryFlow. */
const MAX_SERVICES_PER_REQUEST = 3;

/** Mirrors MIN in BuildInquiryFlow, so the hint text, the live counter and this
 *  check can never disagree. */
const MIN = {
  name: 2,
  businessName: 2,
  businessDescription: 30,
  idea: 50,
} as const;

type BillingSnapshot = {
  name: string;
  phone: string;
  isCompany: boolean;
  companyName: string;
  pib: string;
  mb: string;
  address: string;
  city: string;
  /** Decides which invoice template the buyer gets — see lib/invoices/rules.ts. */
  country: string;
  email: string;
};

/** The services a brief covers, de-duplicated and capped. Accepts `slugs` from
 *  the form or a lone `slug`, same as the video route. */
function readSlugs(body: Record<string, unknown>): string[] {
  const raw = Array.isArray(body.slugs) ? body.slugs : [body.slug];
  const out: string[] = [];
  for (const value of raw) {
    const clean = cleanText(value, 120, 1);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out.slice(0, MAX_SERVICES_PER_REQUEST);
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

  const slugs = readSlugs(body);
  const buyerType =
    body.buyerType === "company"
      ? "company"
      : body.buyerType === "individual"
        ? "individual"
        : null;
  const idea = cleanText(body.idea, 6000, MIN.idea);
  const wishes = cleanText(body.wishes, 4000) ?? "";
  const businessName = cleanText(body.businessName, 160, MIN.businessName);
  const businessDescription = cleanText(
    body.businessDescription,
    2000,
    MIN.businessDescription,
  );
  const timeframe = body.timeframe;
  const name = cleanText(body.name, 120, MIN.name) ?? "";
  const phone = cleanText(body.phone, 40) ?? "";
  const isCompany = buyerType === "company";
  const companyName = cleanText(body.companyName, 160) ?? "";
  const pib = cleanText(body.pib, 20) ?? "";
  const mb = cleanText(body.mb, 20) ?? "";
  const address = cleanText(body.address, 200) ?? "";
  const city = cleanText(body.city, 120) ?? "";
  const country = cleanText(body.country, 80) ?? "";
  const domestic = isSerbia(country);

  // Blank, null and absent all mean "the buyer did not say", which is allowed
  // and is stored as NULL. Only a value that was actually supplied has to be a
  // sane number — a zero or a negative would read in the panel as a real answer.
  const budgetRaw = body.budgetEur;
  const budgetGiven =
    budgetRaw !== null && budgetRaw !== undefined && String(budgetRaw).trim() !== "";
  const budgetEur = budgetGiven ? Number(budgetRaw) : null;
  if (
    budgetEur !== null &&
    (!Number.isFinite(budgetEur) || budgetEur <= 0 || budgetEur > 10_000_000)
  ) {
    return NextResponse.json(
      { ok: false, message: "Budžet mora biti broj veći od nule, ili ostavi prazno." },
      { status: 400 },
    );
  }

  if (
    slugs.length === 0 ||
    !buyerType ||
    !name ||
    !idea ||
    !businessName ||
    !businessDescription
  ) {
    return NextResponse.json(
      { ok: false, message: "Popuni sva obavezna polja." },
      { status: 400 },
    );
  }
  if (!isTimeframe(timeframe)) {
    return NextResponse.json(
      { ok: false, message: "Izaberi vreme isporuke." },
      { status: 400 },
    );
  }
  // PIB and matični broj come from the Serbian register, so a company abroad is
  // not held up by a format it cannot meet.
  if (isCompany && (!companyName || !address || !city)) {
    return NextResponse.json(
      { ok: false, message: "Za pravno lice su obavezni pun naziv, adresa i grad." },
      { status: 400 },
    );
  }
  if (isCompany && domestic && (!/^\d{9}$/.test(pib) || !/^\d{8}$/.test(mb))) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Za domaće pravno lice obavezni su PIB (9 cifara) i matični broj (8 cifara).",
      },
      { status: 400 },
    );
  }

  // Only packages on this rail. A slug from the video catalogue posted here
  // would otherwise open a build brief against a video package and be quoted
  // from the wrong set of answers.
  const found = await Promise.all(slugs.map((item) => getPackageBySlug(item)));
  const chosen = found.filter(
    (item): item is NonNullable<typeof item> => item !== null && item.flow === "build",
  );
  if (chosen.length !== slugs.length) {
    return NextResponse.json(
      { ok: false, message: "Usluga nije pronađena." },
      { status: 404 },
    );
  }

  // The first pick stands in wherever a single package is needed — the order
  // and the project it turns into still point at one row. Everything the buyer
  // and the studio read says all of them, because `service_name` is what is
  // read back.
  const pkg = chosen[0];
  const serviceName = chosen.map((item) => item.name).join(" + ");
  const packageIds = chosen.map((item) => item.id);

  const brief: BuildBrief = { idea, wishes, timeframe };
  const projectTitle = `${businessName} — ${serviceName}`;
  const billing: BillingSnapshot = {
    name,
    phone,
    isCompany,
    companyName,
    pib,
    mb,
    address,
    city,
    country,
    email: user.email,
  };

  const sql = getSql();
  // Counted across both kinds on purpose: five open briefs is five quotes the
  // studio owes somebody, whichever rail they came in on.
  const open = (await sql`
    SELECT count(*)::int AS count
    FROM video_requests
    WHERE user_id = ${user.uid} AND status IN ('submitted', 'quoted')
  `) as { count: number }[];
  if ((open[0]?.count ?? 0) >= MAX_OPEN_REQUESTS) {
    return NextResponse.json(
      { ok: false, message: "Već imaš više aktivnih zahteva. Sačekaj odgovor pre novog upita." },
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
        city = NULLIF(${isCompany ? city : ""}, ''),
        country = COALESCE(NULLIF(${country}, ''), country)
    WHERE id = ${user.uid}
  `;

  const rows = (await sql`
    INSERT INTO video_requests (
      user_id, package_id, package_ids, kind, service_name, project_title, brief,
      buyer_type, business_name, business_description, budget_eur, currency,
      revisions, billing
    )
    VALUES (
      ${user.uid}, ${pkg.id}, ${packageIds}::int[], 'build', ${serviceName},
      ${projectTitle}, ${JSON.stringify(brief)}::jsonb, ${buyerType}, ${businessName},
      ${businessDescription}, ${budgetEur}, ${pkg.currency},
      ${Math.max(...chosen.map((item) => item.revisions))},
      ${JSON.stringify(billing)}::jsonb
    )
    RETURNING id
  `) as { id: number }[];

  const requestId = rows[0].id;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  await queueQuietly({
    userId: user.uid,
    recipient: user.email,
    templateKey: "build_inquiry_received",
    subject: `Upit #${requestId} je stigao — ${serviceName}`,
    body: [
      `Zdravo ${name.split(" ")[0]},`,
      "",
      `Primili smo tvoj upit za ${serviceName}.`,
      "",
      "Šta sledi:",
      "1. Pregledamo opis, želje i rok koji si naveo.",
      "2. Cena i vreme izrade stižu na tvoj nalog — javićemo ti mejlom.",
      "3. Tek tada odlučuješ da li prihvataš. Do tada te ništa ne obavezuje.",
      "",
      "Prati status upita:",
      `${baseUrl}/nalog/zahtevi`,
      "",
      "TOZA AI",
    ].join("\n"),
  });

  await queueStudioNotice({
    templateKey: "studio_new_build_inquiry",
    subject: `Novi upit (razvoj) #${requestId} — ${businessName}`,
    body: [
      `${name} (${user.email}) je poslao upit za ${serviceName}.`,
      "",
      `Biznis: ${businessName}`,
      `Zemlja: ${country || "Srbija"}${domestic ? "" : " — inostrani predračun (EN, IBAN/SWIFT)"}`,
      `Rok: ${TIMEFRAME_LABEL[timeframe]}`,
      `Budžet: ${budgetEur != null ? `${budgetEur} EUR` : "nije naveden"}`,
      "",
      "O biznisu:",
      businessDescription,
      "",
      "Šta traži:",
      idea,
      ...(wishes ? ["", "Želje i funkcionalnosti:", wishes] : []),
      "",
      `Pošalji procenu: ${baseUrl}/admin/video-zahtevi`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, requestId }, { status: 201 });
}

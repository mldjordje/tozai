import "server-only";
import { put } from "@vercel/blob";
import { getSql } from "@/lib/db";
import { getMiddleRate } from "./fx";
import { renderInvoicePdf, type InvoiceDocument, type InvoiceParty } from "./pdf";
import {
  belgradeToday,
  invoiceScope,
  paymentAccountForCurrency,
  paymentReferenceFor,
  referenceModel,
  type InvoiceKind,
} from "./rules";
export type { InvoiceKind } from "./rules";

export class InvoiceConfigurationError extends Error {}

// Issuing a document: allocate the number, freeze the figures, render the PDF.
//
// IDEMPOTENT. A buyer double-clicking checkout, a retried webhook and a repair
// re-run must all produce one proforma and one invoice per order — enforced by
// the UNIQUE (order_id, kind) index, not by checking first and hoping.
//
// Everything the document says is stored on the row (buyer snapshot, item,
// amount, rate). That is what lets the PDF be re-rendered later byte-for-byte
// equivalent, instead of re-deriving it from data that has since moved on.

export type IssuedInvoice = {
  id: number;
  number: string;
  kind: InvoiceKind;
  scope: "domestic" | "foreign";
  pdfUrl: string | null;
};

export type ManualInvoiceInput = {
  kind: InvoiceKind;
  scope: "domestic" | "foreign";
  issuedAt: string;
  /** The day the service was delivered. Editable because it is exactly what an
   *  invoice raised after the fact needs to state — billing last month's work
   *  with this month's date on the promet line is the error the field prevents. */
  supplyDate: string | null;
  dueDate: string | null;
  item: string;
  amount: number;
  currency: string;
  buyer: InvoiceParty;
};

/** Series are separate so a proforma and an invoice never share a number:
 *  PR-2026-0001 is a request to pay, TZ-2026-0001 is a tax document. */
const PREFIX: Record<InvoiceKind, string> = { proforma: "PR", invoice: "TZ" };

type OrderRow = {
  id: number;
  user_id: number | null;
  item: string;
  amount: number;
  currency: string;
  billing: Record<string, unknown> | null;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_country: string | null;
};

type SettingsRow = {
  name: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  pib: string | null;
  mb: string | null;
  bank_account: string | null;
  eur_account: string | null;
  usd_account: string | null;
  iban: string | null;
  swift: string | null;
  bank_name: string | null;
  bank_address: string | null;
  vat_note_domestic: string | null;
  vat_note_foreign: string | null;
  invoice_due_days: number | null;
  payment_reference_model: string | null;
};

/** Columns every document render needs from the single settings row. Written once
 *  because it is selected from three places and a column missing from one of them
 *  is a field silently absent from that one document. */
const SETTINGS_COLUMNS = `name, company_name, address, city, email, phone, pib, mb,
       bank_account, eur_account, usd_account, iban, swift, bank_name, bank_address,
       vat_note_domestic, vat_note_foreign, invoice_due_days, payment_reference_model`;

/** sql.query, not the template tag: an interpolation into the tag becomes a bound
 *  parameter, which cannot be a column list. The string is a constant above with
 *  no caller input in it. */
async function loadSettings(): Promise<SettingsRow> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT ${SETTINGS_COLUMNS} FROM studio_settings WHERE id = 1`,
  )) as SettingsRow[];
  return rows[0] ?? ({} as SettingsRow);
}

/**
 * The payment fields for one document: the reference the bank will accept, the
 * purpose line, and the dinar settlement note where one is needed.
 *
 * Shared by all three entry points so an order-issued document, a manual one and
 * a re-render can never disagree about what the buyer was told to pay.
 */
function paymentFields(args: {
  number: string;
  scope: "domestic" | "foreign";
  currency: string;
  rsdAmount: number | null;
  model: string | null;
}): Pick<InvoiceDocument, "reference" | "paymentPurpose" | "settlementNote"> {
  const reference = paymentReferenceFor(args.number, referenceModel(args.model));
  const foreignCurrency = args.currency.trim().toUpperCase() !== "RSD";

  let settlementNote: string | null = null;
  if (args.scope === "domestic" && foreignCurrency) {
    const rsd = args.rsdAmount
      ? `${args.rsdAmount.toLocaleString("sr-RS", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} RSD`
      : null;
    settlementNote = rsd
      ? `Uplata se vrši u dinarima na navedeni račun, u iznosu od ${rsd}.`
      : "Uplata se vrši u dinarima na navedeni račun, po srednjem kursu NBS na dan uplate.";
  }

  return { reference, paymentPurpose: args.number, settlementNote };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buyerFrom(order: OrderRow): InvoiceParty {
  const b = (order.billing ?? {}) as Record<string, unknown>;
  return {
    name: str(b.name) ?? order.buyer_name,
    companyName: str(b.companyName),
    address: str(b.address),
    city: str(b.city),
    country: str(b.country) ?? order.buyer_country,
    pib: str(b.pib),
    mb: str(b.mb),
    email: order.buyer_email,
    phone: str(b.phone),
  };
}

export async function issueInvoice(
  orderId: number,
  kind: InvoiceKind,
): Promise<IssuedInvoice | null> {
  const sql = getSql();

  const orders = (await sql`
    SELECT o.id, o.user_id, o.item, o.amount::float8 AS amount, o.currency, o.billing,
           u.email AS buyer_email, u.name AS buyer_name, u.country AS buyer_country
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = ${orderId}
  `) as OrderRow[];
  const order = orders[0];
  if (!order) return null;

  // Already issued? Hand back what exists. Re-rendering would allocate nothing
  // new but would overwrite a document the buyer may already be holding.
  const existing = (await sql`
    SELECT id, number, kind, scope, pdf_url
    FROM invoices WHERE order_id = ${orderId} AND kind = ${kind}
  `) as { id: number; number: string; kind: InvoiceKind; scope: "domestic" | "foreign"; pdf_url: string | null }[];
  if (existing[0]) {
    return {
      id: existing[0].id,
      number: existing[0].number,
      kind: existing[0].kind,
      scope: existing[0].scope,
      pdfUrl: existing[0].pdf_url,
    };
  }

  const settings = await loadSettings();

  const buyer = buyerFrom(order);
  const scope = invoiceScope(buyer.country);
  const rate = await getMiddleRate(order.currency);

  const dueDays = settings.invoice_due_days ?? 5;
  // Belgrade, not the server's UTC clock: see belgradeToday(). The year here picks
  // the number series, so getting it from the wrong timezone puts a January
  // document in the previous year's sequence.
  const today = belgradeToday();
  const year = today.year;
  const prefix = PREFIX[kind];

  // The number is allocated inside the INSERT so the MAX and the write are one
  // statement — the same shape fulfillPaidOrder() uses. Two concurrent callers
  // can still read the same MAX under READ COMMITTED; one of the unique indexes
  // (number, or order_id+kind) rejects the loser.
  //
  // The MAX is a scalar subquery, not an aggregate over the outer SELECT: an
  // aggregate with no GROUP BY yields a row even when nothing matches, which
  // would defeat the NOT EXISTS guard entirely.
  const inserted = (await sql`
    INSERT INTO invoices (
      order_id, kind, scope, number, amount, currency, item, buyer,
      issued_at, supply_date, due_date, amount_rsd, fx_rate, fx_date
    )
    SELECT ${orderId}, ${kind}, ${scope},
           ${prefix} || '-' || ${year}::text || '-' ||
             LPAD((
               COALESCE((
                 SELECT MAX(SUBSTRING(i.number FROM ${`${prefix}-[0-9]{4}-([0-9]+)`})::int)
                 FROM invoices i
                 WHERE i.number LIKE ${`${prefix}-${year}-%`}
               ), 0) + 1
             )::text, 4, '0'),
           ${order.amount}, ${order.currency}, ${order.item},
           ${JSON.stringify(buyer)}::jsonb,
           ${today.iso}::date,
           -- A proforma precedes the work, so it has no date of supply. An
           -- invoice here is raised once the order is paid and delivered, so the
           -- supply is today's.
           ${kind === "invoice" ? today.iso : null}::date,
           ${today.iso}::date + ${dueDays}::int,
           ${rate ? order.amount * rate.rate : null},
           ${rate?.rate ?? null},
           ${rate?.date ?? null}
    WHERE NOT EXISTS (
      SELECT 1 FROM invoices x WHERE x.order_id = ${orderId} AND x.kind = ${kind}
    )
    RETURNING id, number
  `) as { id: number; number: string }[];

  if (!inserted[0]) {
    // Lost the race: the winner's row is the one that counts.
    const winner = (await sql`
      SELECT id, number, pdf_url FROM invoices WHERE order_id = ${orderId} AND kind = ${kind}
    `) as { id: number; number: string; pdf_url: string | null }[];
    return winner[0]
      ? { id: winner[0].id, number: winner[0].number, kind, scope, pdfUrl: winner[0].pdf_url }
      : null;
  }

  const { id, number } = inserted[0];
  // Noon, so formatting the date back out in any nearby timezone lands on the same
  // calendar day the row stores.
  const issuedAt = new Date(`${today.iso}T12:00:00Z`);
  const document: InvoiceDocument = {
    kind,
    scope,
    number,
    issuedAt,
    supplyDate: kind === "invoice" ? issuedAt : null,
    placeOfIssue: settings.city,
    dueDate: new Date(issuedAt.getTime() + dueDays * 86_400_000),
    item: order.item,
    amount: order.amount,
    currency: order.currency,
    rsd: rate ? { amount: order.amount * rate.rate, rate: rate.rate, date: rate.date } : null,
    seller: {
      name: settings.name,
      companyName: settings.company_name,
      address: settings.address,
      city: settings.city,
      country: scope === "foreign" ? "Serbia" : null,
      pib: settings.pib,
      mb: settings.mb,
      email: settings.email,
      phone: settings.phone,
      bankAccount: settings.bank_account,
      eurAccount: settings.eur_account,
      usdAccount: settings.usd_account,
      iban: settings.iban,
      swift: settings.swift,
      bankName: settings.bank_name,
      bankAddress: settings.bank_address,
    },
    buyer,
    ...paymentFields({
      number,
      scope,
      currency: order.currency,
      rsdAmount: rate ? order.amount * rate.rate : null,
      model: settings.payment_reference_model,
    }),
    vatNote:
      (scope === "foreign" ? settings.vat_note_foreign : settings.vat_note_domestic) ?? "",
  };

  let pdfUrl: string | null = null;
  try {
    const bytes = await renderInvoicePdf(document);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Random suffix: the URL is the only thing standing between a stored PDF
      // and anyone who guesses a filename, and these carry the buyer's address
      // and tax number. The URL is never handed to the browser either — the
      // dashboard links to an authenticated route instead.
      const blob = await put(`fakture/${number}.pdf`, Buffer.from(bytes), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
      });
      pdfUrl = blob.url;
      await sql`
        UPDATE invoices SET pdf_url = ${blob.url}, blob_pathname = ${blob.pathname}
        WHERE id = ${id}
      `;
    }
  } catch (error) {
    // The document exists and is numbered whether or not the PDF was stored;
    // the download route re-renders from the row on demand. Failing here would
    // mean losing an allocated number for a cosmetic problem.
    console.error("[invoices] PDF render/upload failed", number, error);
  }

  return { id, number, kind, scope, pdfUrl };
}

/**
 * Issue a standalone document entered by an administrator. Manual documents
 * deliberately have no order_id; that keeps customer fulfilment untouched
 * while letting the shared invoice table, numbering and PDF renderer remain
 * the single source of truth.
 */
export async function issueManualInvoice(
  input: ManualInvoiceInput,
): Promise<IssuedInvoice> {
  const sql = getSql();
  const settings = await loadSettings();
  const paymentAccount = paymentAccountForCurrency(input.currency, {
    domestic: settings.bank_account,
    eur: settings.eur_account,
    usd: settings.usd_account,
    legacyForeign: settings.iban,
  });
  if (!paymentAccount) {
    throw new InvoiceConfigurationError(
      `U Podešavanjima prvo unesi račun za valutu ${input.currency}.`,
    );
  }
  const rate = await getMiddleRate(input.currency);
  const year = Number(input.issuedAt.slice(0, 4));
  const prefix = PREFIX[input.kind];

  const inserted = (await sql`
    INSERT INTO invoices (
      order_id, kind, scope, number, amount, currency, item, buyer,
      issued_at, supply_date, due_date, amount_rsd, fx_rate, fx_date
    )
    SELECT NULL, ${input.kind}, ${input.scope},
           ${prefix} || '-' || ${year}::text || '-' ||
             LPAD((
               COALESCE((
                 SELECT MAX(SUBSTRING(i.number FROM ${`${prefix}-[0-9]{4}-([0-9]+)`})::int)
                 FROM invoices i
                 WHERE i.number LIKE ${`${prefix}-${year}-%`}
               ), 0) + 1
             )::text, 4, '0'),
           ${input.amount}, ${input.currency}, ${input.item},
           ${JSON.stringify(input.buyer)}::jsonb,
           ${input.issuedAt}::date,
           -- Falls back to the issue date rather than to NULL: a manual invoice
           -- with no promet date stated is the document that is missing a required
           -- element, and for same-day work the two genuinely coincide.
           ${input.kind === "invoice" ? (input.supplyDate ?? input.issuedAt) : null}::date,
           ${input.dueDate}::date,
           ${rate ? input.amount * rate.rate : null},
           ${rate?.rate ?? null},
           ${rate?.date ?? null}
    RETURNING id, number
  `) as { id: number; number: string }[];

  const { id, number } = inserted[0];
  const issuedAt = new Date(`${input.issuedAt}T12:00:00Z`);
  const dueDate = input.dueDate ? new Date(`${input.dueDate}T12:00:00Z`) : null;
  const supplyIso = input.kind === "invoice" ? (input.supplyDate ?? input.issuedAt) : null;
  const document: InvoiceDocument = {
    kind: input.kind,
    scope: input.scope,
    number,
    issuedAt,
    supplyDate: supplyIso ? new Date(`${supplyIso}T12:00:00Z`) : null,
    placeOfIssue: settings.city,
    dueDate,
    item: input.item,
    amount: input.amount,
    currency: input.currency,
    rsd: rate ? { amount: input.amount * rate.rate, rate: rate.rate, date: rate.date } : null,
    seller: {
      name: settings.name,
      companyName: settings.company_name,
      address: settings.address,
      city: settings.city,
      country: input.scope === "foreign" ? "Serbia" : null,
      pib: settings.pib,
      mb: settings.mb,
      email: settings.email,
      phone: settings.phone,
      bankAccount: settings.bank_account,
      eurAccount: settings.eur_account,
      usdAccount: settings.usd_account,
      iban: settings.iban,
      swift: settings.swift,
      bankName: settings.bank_name,
      bankAddress: settings.bank_address,
    },
    buyer: input.buyer,
    ...paymentFields({
      number,
      scope: input.scope,
      currency: input.currency,
      rsdAmount: rate ? input.amount * rate.rate : null,
      model: settings.payment_reference_model,
    }),
    vatNote:
      (input.scope === "foreign" ? settings.vat_note_foreign : settings.vat_note_domestic) ?? "",
  };

  let pdfUrl: string | null = null;
  try {
    const bytes = await renderInvoicePdf(document);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`fakture/${number}.pdf`, Buffer.from(bytes), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
      });
      pdfUrl = blob.url;
      await sql`
        UPDATE invoices SET pdf_url = ${blob.url}, blob_pathname = ${blob.pathname}
        WHERE id = ${id}
      `;
    }
  } catch (error) {
    console.error("[invoices] Manual PDF render/upload failed", number, error);
  }

  return { id, number, kind: input.kind, scope: input.scope, pdfUrl };
}

/**
 * Re-render an already issued document from its stored snapshot. Used by the
 * authenticated download route so a PDF that never made it to Blob (or was
 * issued while storage was unconfigured) is still downloadable.
 */
export async function renderStoredInvoice(invoiceId: number): Promise<{ bytes: Uint8Array; number: string } | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT i.id, i.order_id, i.kind, i.scope, i.number, i.amount::float8 AS amount, i.currency,
           i.item, i.buyer, i.issued_at, i.supply_date, i.due_date,
           i.amount_rsd::float8 AS amount_rsd, i.fx_rate::float8 AS fx_rate, i.fx_date,
           o.item AS order_item
    FROM invoices i
    LEFT JOIN orders o ON o.id = i.order_id
    WHERE i.id = ${invoiceId}
  `) as {
    id: number;
    order_id: number | null;
    kind: InvoiceKind;
    scope: "domestic" | "foreign";
    number: string;
    amount: number;
    currency: string;
    item: string | null;
    buyer: InvoiceParty | null;
    issued_at: string;
    supply_date: string | null;
    due_date: string | null;
    amount_rsd: number | null;
    fx_rate: number | null;
    fx_date: string | null;
    order_item: string | null;
  }[];
  const row = rows[0];
  if (!row) return null;

  const settings = await loadSettings();

  const bytes = await renderInvoicePdf({
    kind: row.kind,
    scope: row.scope,
    number: row.number,
    issuedAt: new Date(row.issued_at),
    supplyDate: row.supply_date ? new Date(row.supply_date) : null,
    placeOfIssue: settings.city,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    item: row.item ?? row.order_item ?? "—",
    amount: row.amount,
    currency: row.currency,
    rsd:
      row.amount_rsd && row.fx_rate
        ? { amount: row.amount_rsd, rate: row.fx_rate, date: row.fx_date ?? "" }
        : null,
    seller: {
      name: settings.name,
      companyName: settings.company_name,
      address: settings.address,
      city: settings.city,
      country: row.scope === "foreign" ? "Serbia" : null,
      pib: settings.pib,
      mb: settings.mb,
      email: settings.email,
      phone: settings.phone,
      bankAccount: settings.bank_account,
      eurAccount: settings.eur_account,
      usdAccount: settings.usd_account,
      iban: settings.iban,
      swift: settings.swift,
      bankName: settings.bank_name,
      bankAddress: settings.bank_address,
    },
    buyer: row.buyer ?? { name: null },
    ...paymentFields({
      number: row.number,
      scope: row.scope,
      currency: row.currency,
      rsdAmount: row.amount_rsd,
      model: settings.payment_reference_model,
    }),
    vatNote: (row.scope === "foreign" ? settings.vat_note_foreign : settings.vat_note_domestic) ?? "",
  });

  return { bytes, number: row.number };
}

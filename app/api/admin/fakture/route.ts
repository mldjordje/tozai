import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  issueManualInvoice,
  type ManualInvoiceInput,
} from "@/lib/invoices/issue";
import type { InvoiceParty } from "@/lib/invoices/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const optional = (value: unknown, max: number) => text(value, max) || null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET() {
  const sql = getSql();
  const documents = await sql`
    SELECT i.id, i.order_id, i.number, i.kind, i.scope,
           i.amount::float8 AS amount, i.currency, i.item, i.buyer,
           i.issued_at::text AS issued_at, i.due_date::text AS due_date,
           i.created_at::text AS created_at,
           u.name AS user_name, u.email AS user_email
    FROM invoices i
    LEFT JOIN orders o ON o.id = i.order_id
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY i.issued_at DESC NULLS LAST, i.id DESC
  `;
  return NextResponse.json({ ok: true, documents });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind === "invoice" ? "invoice" : body.kind === "proforma" ? "proforma" : null;
  const scope = body.scope === "foreign" ? "foreign" : body.scope === "domestic" ? "domestic" : null;
  const issuedAt = text(body.issuedAt, 10);
  const dueDate = text(body.dueDate, 10);
  const item = text(body.item, 500);
  const amount = Number(body.amount);
  const currency = text(body.currency, 8).toUpperCase();

  if (!kind || !scope) {
    return NextResponse.json({ ok: false, message: "Izaberi vrstu dokumenta i tržište." }, { status: 400 });
  }
  if (!validDate(issuedAt) || (dueDate && !validDate(dueDate))) {
    return NextResponse.json({ ok: false, message: "Datum izdavanja ili dospeća nije ispravan." }, { status: 400 });
  }
  if (dueDate && dueDate < issuedAt) {
    return NextResponse.json({ ok: false, message: "Datum dospeća ne može biti pre datuma izdavanja." }, { status: 400 });
  }
  if (!item || !Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ ok: false, message: "Opis, pozitivan iznos i valuta su obavezni." }, { status: 400 });
  }

  const buyer: InvoiceParty = {
    name: optional(body.buyerName, 200),
    companyName: optional(body.companyName, 200),
    address: optional(body.address, 250),
    city: optional(body.city, 120),
    country: optional(body.country, 120),
    pib: optional(body.pib, 40),
    mb: optional(body.mb, 40),
    email: optional(body.email, 254),
    phone: optional(body.phone, 60),
  };
  if (!buyer.name && !buyer.companyName) {
    return NextResponse.json({ ok: false, message: "Unesi ime kupca ili naziv firme." }, { status: 400 });
  }

  const input: ManualInvoiceInput = {
    kind,
    scope,
    issuedAt,
    dueDate: dueDate || null,
    item,
    amount,
    currency,
    buyer,
  };
  const document = await issueManualInvoice(input);
  return NextResponse.json({ ok: true, document }, { status: 201 });
}

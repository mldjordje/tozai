import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Invoice / proforma renderer.
//
// Two templates, one layout: the domestic Serbian document and the English one
// for foreign buyers. They differ in language, in which account is printed
// (dinar account vs IBAN/SWIFT) and in the VAT sentence — not in structure, so
// they share every measurement here.
//
// FONTS. The PDF standard faces are WinAnsi-encoded, which has no č, ć, š, ž or
// đ — a Serbian invoice drawn with Helvetica either throws or silently drops
// the diacritics. Noto Sans (OFL, bundled in ./fonts) is embedded instead.
// next.config.ts force-includes these files in the serverless bundle; without
// that they exist locally and vanish in production.

export type InvoiceParty = {
  name: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  pib?: string | null;
  mb?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type InvoiceDocument = {
  kind: "proforma" | "invoice";
  scope: "domestic" | "foreign";
  number: string;
  issuedAt: Date;
  dueDate: Date | null;
  item: string;
  amount: number;
  currency: string;
  /** Dinar equivalent and the rate it was computed at. Absent when the rate
   *  could not be fetched, or when the invoice is already in RSD. */
  rsd?: { amount: number; rate: number; date: string } | null;
  seller: InvoiceParty & {
    bankAccount?: string | null;
    iban?: string | null;
    swift?: string | null;
    bankName?: string | null;
    bankAddress?: string | null;
  };
  buyer: InvoiceParty;
  /** Reference the payer must quote, so the studio can match the transfer. */
  reference: string;
  vatNote: string;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const INK = rgb(0.07, 0.07, 0.09);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.85, 0.85, 0.88);
const ACCENT = rgb(0.18, 0.42, 1);

const LABELS = {
  sr: {
    proforma: "PREDRAČUN",
    invoice: "RAČUN",
    number: "Broj",
    issued: "Datum izdavanja",
    due: "Rok plaćanja",
    seller: "Izdavalac",
    buyer: "Kupac",
    description: "Opis",
    qty: "Kol.",
    price: "Cena",
    total: "Iznos",
    grandTotal: "UKUPNO ZA UPLATU",
    payment: "Podaci za uplatu",
    recipient: "Primalac",
    account: "Račun",
    reference: "Poziv na broj",
    pib: "PIB",
    mb: "Matični broj",
    rateNote: (rate: string, date: string) => `Obračunato po srednjem kursu NBS ${rate} RSD/EUR na dan ${date}.`,
    proformaNote:
      "Ovo je predračun i ne predstavlja poresku ispravu. Račun se izdaje nakon evidentirane uplate.",
    footer: "Dokument je izdat elektronski i punovažan je bez pečata i potpisa.",
  },
  en: {
    proforma: "PROFORMA INVOICE",
    invoice: "INVOICE",
    number: "No.",
    issued: "Date of issue",
    due: "Payment due",
    seller: "Supplier",
    buyer: "Customer",
    description: "Description",
    qty: "Qty",
    price: "Price",
    total: "Amount",
    grandTotal: "TOTAL DUE",
    payment: "Payment details",
    recipient: "Beneficiary",
    account: "IBAN",
    reference: "Payment reference",
    pib: "Tax ID",
    mb: "Company No.",
    rateNote: (rate: string, date: string) => `RSD equivalent at the NBS middle rate ${rate} RSD/EUR on ${date}.`,
    proformaNote:
      "This is a proforma invoice and is not a tax document. The invoice follows once payment is received.",
    footer: "Issued electronically; valid without signature or stamp.",
  },
} as const;

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "lib", "invoices", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "NotoSans-Regular.ttf")),
    readFile(path.join(dir, "NotoSans-Bold.ttf")),
  ]);
  fontCache = { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
  return fontCache;
}

function money(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency.toUpperCase()}`;
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${date.getFullYear()}.`;
}

/** Wraps to `width`, measuring in the font it will actually be drawn with —
 *  a character count would break on the wide glyphs company names are full of. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Uint8Array> {
  const t = LABELS[doc.scope === "foreign" ? "en" : "sr"];
  const fonts = await loadFonts();

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const page = pdf.addPage([A4.width, A4.height]);

  pdf.setTitle(`${doc.kind === "proforma" ? t.proforma : t.invoice} ${doc.number}`);
  pdf.setProducer("TOZA AI");
  pdf.setCreationDate(doc.issuedAt);

  const right = A4.width - MARGIN;
  const contentWidth = right - MARGIN;
  let y = A4.height - MARGIN;

  const text = (
    value: string,
    x: number,
    size: number,
    options: { font?: PDFFont; color?: typeof INK; align?: "left" | "right" } = {},
  ) => {
    const font = options.font ?? regular;
    const drawX =
      options.align === "right" ? x - font.widthOfTextAtSize(value, size) : x;
    page.drawText(value, { x: drawX, y, size, font, color: options.color ?? INK });
  };

  const rule = (target: PDFPage, atY: number) =>
    target.drawLine({
      start: { x: MARGIN, y: atY },
      end: { x: right, y: atY },
      thickness: 0.7,
      color: LINE,
    });

  // ---- header: who is issuing, and what this document is -------------------
  text(doc.seller.companyName ?? doc.seller.name ?? "TOZA AI", MARGIN, 16, { font: bold });
  text(doc.kind === "proforma" ? t.proforma : t.invoice, right, 16, { font: bold, align: "right", color: ACCENT });
  y -= 18;
  text(`${t.number}: ${doc.number}`, right, 10, { align: "right", color: MUTED });

  for (const line of [
    doc.seller.address,
    [doc.seller.city, doc.seller.country].filter(Boolean).join(", ") || null,
    doc.seller.pib ? `${t.pib}: ${doc.seller.pib}` : null,
    doc.seller.mb ? `${t.mb}: ${doc.seller.mb}` : null,
    doc.seller.email,
  ]) {
    if (!line) continue;
    text(line, MARGIN, 9, { color: MUTED });
    y -= 12;
  }

  y -= 6;
  text(`${t.issued}: ${formatDate(doc.issuedAt)}`, right, 9, { align: "right", color: MUTED });
  y -= 12;
  if (doc.dueDate) {
    text(`${t.due}: ${formatDate(doc.dueDate)}`, right, 9, { align: "right", color: MUTED });
    y -= 12;
  }

  y -= 14;
  rule(page, y);
  y -= 22;

  // ---- buyer ---------------------------------------------------------------
  text(t.buyer, MARGIN, 8, { color: MUTED });
  y -= 14;
  const buyerName = doc.buyer.companyName?.trim() || doc.buyer.name?.trim() || "—";
  text(buyerName, MARGIN, 12, { font: bold });
  y -= 15;
  for (const line of [
    doc.buyer.address,
    [doc.buyer.city, doc.buyer.country].filter(Boolean).join(", ") || null,
    doc.buyer.pib ? `${t.pib}: ${doc.buyer.pib}` : null,
    doc.buyer.mb ? `${t.mb}: ${doc.buyer.mb}` : null,
    doc.buyer.email,
  ]) {
    if (!line) continue;
    text(line, MARGIN, 9, { color: MUTED });
    y -= 12;
  }

  y -= 18;

  // ---- item table ----------------------------------------------------------
  const columns = { qty: right - 210, price: right - 120, total: right };
  text(t.description, MARGIN, 8, { color: MUTED });
  text(t.qty, columns.qty, 8, { color: MUTED, align: "right" });
  text(t.price, columns.price, 8, { color: MUTED, align: "right" });
  text(t.total, columns.total, 8, { color: MUTED, align: "right" });
  y -= 8;
  rule(page, y);
  y -= 16;

  const itemLines = wrap(doc.item, regular, 10, columns.qty - MARGIN - 20);
  const rowTop = y;
  for (const line of itemLines) {
    text(line, MARGIN, 10);
    y -= 13;
  }
  y = rowTop;
  text("1", columns.qty, 10, { align: "right" });
  text(money(doc.amount, doc.currency), columns.price, 10, { align: "right" });
  text(money(doc.amount, doc.currency), columns.total, 10, { align: "right" });
  y -= 13 * Math.max(itemLines.length, 1);

  y -= 10;
  rule(page, y);
  y -= 22;

  // ---- total ---------------------------------------------------------------
  text(t.grandTotal, columns.price, 11, { font: bold, align: "right" });
  text(money(doc.amount, doc.currency), columns.total, 13, { font: bold, align: "right" });
  y -= 16;
  if (doc.rsd) {
    text(money(doc.rsd.amount, "RSD"), columns.total, 10, { align: "right", color: MUTED });
    y -= 13;
    text(
      t.rateNote(
        doc.rsd.rate.toLocaleString("sr-RS", { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        doc.rsd.date,
      ),
      right,
      8,
      { align: "right", color: MUTED },
    );
    y -= 12;
  }

  y -= 20;

  // ---- how to pay ----------------------------------------------------------
  // The foreign document prints IBAN + SWIFT: a transfer from abroad cannot be
  // made against a domestic dinar account number.
  const accountValue =
    doc.scope === "foreign" ? doc.seller.iban : doc.seller.bankAccount ?? doc.seller.iban;

  text(t.payment, MARGIN, 8, { color: MUTED });
  y -= 15;
  const payRows: [string, string | null | undefined][] = [
    [t.recipient, doc.seller.companyName ?? doc.seller.name],
    [t.account, accountValue],
    ...(doc.scope === "foreign"
      ? ([
          ["SWIFT/BIC", doc.seller.swift],
          ["Bank", doc.seller.bankName],
          ["Bank address", doc.seller.bankAddress],
        ] as [string, string | null | undefined][])
      : []),
    [t.reference, doc.reference],
  ];
  for (const [label, value] of payRows) {
    if (!value) continue;
    text(`${label}:`, MARGIN, 9, { color: MUTED });
    text(value, MARGIN + 110, 9, { font: bold });
    y -= 14;
  }

  y -= 14;

  // ---- notes ---------------------------------------------------------------
  for (const note of [doc.kind === "proforma" ? t.proformaNote : null, doc.vatNote]) {
    if (!note) continue;
    for (const line of wrap(note, regular, 8.5, contentWidth)) {
      text(line, MARGIN, 8.5, { color: MUTED });
      y -= 11;
    }
    y -= 6;
  }

  // ---- footer --------------------------------------------------------------
  y = MARGIN + 14;
  rule(page, y + 12);
  text(t.footer, MARGIN, 8, { color: MUTED });

  return pdf.save();
}

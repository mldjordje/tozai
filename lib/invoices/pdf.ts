import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { settlementAccount } from "./rules";

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
    eurAccount?: string | null;
    usdAccount?: string | null;
    iban?: string | null;
    swift?: string | null;
    bankName?: string | null;
    bankAddress?: string | null;
  };
  buyer: InvoiceParty;
  /** The day the service was delivered. A mandatory element of a Serbian
   *  invoice, and not the same as `issuedAt` — a proforma has no supply yet, so
   *  it is null there. */
  supplyDate?: Date | null;
  /** Where the document was issued. "Mesto i datum izdavanja" is one required
   *  element; only the date half was ever printed. */
  placeOfIssue?: string | null;
  /** Numeric model-97 reference, when the issuer uses one. Null means the payment
   *  purpose below is printed instead — see lib/invoices/rules.ts. */
  reference: string | null;
  /** What the payer should write as the purpose of payment. The document's own
   *  number, which is what a buyer can actually match a transfer against. */
  paymentPurpose: string;
  /** Dinar settlement line for a domestic invoice denominated in euros: the
   *  amount is invoiced in EUR and paid in RSD. */
  settlementNote?: string | null;
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
    place: "Mesto izdavanja",
    supply: "Datum prometa",
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
    model: "Model",
    purpose: "Svrha uplate",
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
    place: "Place of issue",
    supply: "Date of supply",
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
    account: "Account / IBAN",
    reference: "Payment reference",
    model: "Model",
    purpose: "Payment purpose",
    pib: "Tax ID",
    mb: "Company No.",
    rateNote: (rate: string, date: string) => `RSD equivalent at the NBS middle rate ${rate} RSD/EUR on ${date}.`,
    proformaNote:
      "This is a proforma invoice and is not a tax document. The invoice follows once payment is received.",
    footer: "Issued electronically; valid without signature or stamp.",
  },
} as const;

// Brand mark, drawn as vector paths rather than embedded as an image: the same
// geometry as components/brand/Logo.tsx, so the document cannot drift from the
// site, and there is no asset to ship, fetch or fail to find at runtime.
//
// The web mark is near-white on a dark tile. On paper that would be invisible,
// so the bird takes the document's ink colour and only the accent diamond keeps
// the brand purple.
const LOGO_SIZE = 34;
const LOGO_VIEWBOX = 64;
const LOGO_ACCENT = rgb(0.61, 0.49, 1);
const LOGO_PATHS = [
  "M30.2 24.9C24.4 20.4 16.3 15.8 5.5 11l6.8 17.2 15.4 8.2 2.5-11.5Z",
  "m27.3 34-14.9-6 5.5 12.1 11.7 5.4L27.3 34Z",
  "m29.2 43-10.8-3.4 5.9 9.2 7 4.3L29.2 43Z",
  "M33.8 24.9C39.6 20.4 47.7 15.8 58.5 11l-6.8 17.2-15.4 8.2-2.5-11.5Z",
  "m36.7 34 14.9-6-5.5 12.1-11.7 5.4 2.3-11.5Z",
  "m34.8 43 10.8-3.4-5.9 9.2-7 4.3 2.1-10.1Z",
  "m31.8 6.5 7.4 4.8-5 .6c-2.2 2.5-2.4 5.7-.8 9.5l2 4.8L32 43.8l-3.4-17.6 2-4.8c1.2-3 .9-5.5-.8-7.5l-5.3 2.4 3.2-6.4 4.1-3.4Z",
];
const LOGO_ACCENT_PATH = "m32 46 5.1 8.1L32 63l-5.1-8.9L32 46Z";

/** `top` is the y of the mark's top edge — drawSvgPath anchors the viewBox
 *  origin at the given point and grows downward, the opposite of every other
 *  measurement in this file. */
function drawLogo(page: PDFPage, x: number, top: number) {
  const scale = LOGO_SIZE / LOGO_VIEWBOX;
  for (const path of LOGO_PATHS) {
    page.drawSvgPath(path, { x, y: top, scale, color: INK, borderWidth: 0 });
  }
  page.drawSvgPath(LOGO_ACCENT_PATH, { x, y: top, scale, color: LOGO_ACCENT, borderWidth: 0 });
}

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
  // The mark sits in the top-left corner and the issuer block is indented past
  // it, so the two never collide however many address lines are filled in.
  drawLogo(page, MARGIN, y + LOGO_SIZE - 12);
  const headerLeft = MARGIN + LOGO_SIZE + 12;

  text(doc.seller.companyName ?? doc.seller.name ?? "TOZA AI", headerLeft, 16, { font: bold });
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
    text(line, headerLeft, 9, { color: MUTED });
    y -= 12;
  }

  y -= 6;
  // "Mesto i datum izdavanja" and "datum prometa" are both required elements of a
  // Serbian invoice. The supply date is the day the service was delivered, which
  // is why it is a separate line and not a restatement of the issue date — a
  // proforma leaves it out entirely, since nothing has been supplied yet.
  for (const line of [
    doc.placeOfIssue ? `${t.place}: ${doc.placeOfIssue}` : null,
    `${t.issued}: ${formatDate(doc.issuedAt)}`,
    doc.supplyDate ? `${t.supply}: ${formatDate(doc.supplyDate)}` : null,
    doc.dueDate ? `${t.due}: ${formatDate(doc.dueDate)}` : null,
  ]) {
    if (!line) continue;
    text(line, right, 9, { align: "right", color: MUTED });
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
  // A domestic transfer settles in dinars whatever the invoice is denominated in,
  // so the account follows the SCOPE and not just the currency. Foreign documents
  // also print the SWIFT and bank details an international transfer needs.
  const accountValue = settlementAccount(doc.scope, doc.currency, {
    domestic: doc.seller.bankAccount,
    eur: doc.seller.eurAccount,
    usd: doc.seller.usdAccount,
    legacyForeign: doc.seller.iban,
  });

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
    // The model only appears next to a reference that actually has check digits.
    // A "Poziv na broj" line holding something a bank field will not accept is
    // worse than no line at all — it invites the buyer to type it and fail.
    ...(doc.reference
      ? ([
          [t.model, "97"],
          [t.reference, doc.reference],
        ] as [string, string | null | undefined][])
      : []),
    [t.purpose, doc.paymentPurpose],
  ];
  for (const [label, value] of payRows) {
    if (!value) continue;
    text(`${label}:`, MARGIN, 9, { color: MUTED });
    text(value, MARGIN + 110, 9, { font: bold });
    y -= 14;
  }

  if (doc.settlementNote) {
    y -= 2;
    for (const line of wrap(doc.settlementNote, regular, 8.5, contentWidth)) {
      text(line, MARGIN, 8.5, { color: MUTED });
      y -= 11;
    }
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

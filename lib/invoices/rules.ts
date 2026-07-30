// Relative, not "@/lib/…": this module is covered by tests/invoice-rules.test.mts,
// which runs on bare node with no path aliases.
import { isSerbia } from "../countries.ts";

export type InvoiceKind = "proforma" | "invoice";

export function invoiceNumber(
  kind: InvoiceKind,
  year: number,
  sequence: number,
): string {
  const prefix = kind === "proforma" ? "PR" : "TZ";
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Which of the two templates a buyer gets.
 *
 * The spelling rules live in lib/countries.ts, next to the list the buyer picks
 * from, so the select, the API validation and the document can never disagree
 * about what counts as domestic.
 */
export function invoiceScope(
  country: string | null | undefined,
): "domestic" | "foreign" {
  return isSerbia(country) ? "domestic" : "foreign";
}

/**
 * Payment reference, the "poziv na broj" on a Serbian transfer order.
 *
 * NOT a legally required element of an invoice — the mandatory list is place and
 * date of issue, serial number, both parties with their PIB, description and
 * scope of the service, the DATE OF SUPPLY, the amount, and (for a non-VAT
 * issuer) the note naming the provision under which VAT was not charged. The
 * reference is a banking convenience: it rides along on the transfer so incoming
 * payments can be matched to documents automatically.
 *
 * Two things follow from that, and the old code got both wrong by printing
 * `TZ-00042` under a "Poziv na broj" label:
 *
 *   - The field takes DIGITS. A reference with letters in it cannot be entered
 *     into the poziv-na-broj field in e-banking, so the buyer either drops it or
 *     gets the order rejected — and the studio loses the very matching the field
 *     exists for.
 *   - Under model 97 the first two digits are a checksum (ISO 7064, MOD 97-10)
 *     that the bank verifies. A reference with no valid check digits is refused
 *     outright if the payer selects the model.
 *
 * So the model is a setting. An issuer who does not use poziv na broj — which is
 * every issuer who has never heard of it — gets the document number printed as
 * the payment purpose instead, which is what their existing invoices do.
 */
export type ReferenceModel = "none" | "97";

export function referenceModel(value: string | null | undefined): ReferenceModel {
  return value?.trim() === "97" ? "97" : "none";
}

/**
 * ISO 7064 MOD 97-10 check digits for a numeric string.
 *
 * The remainder is accumulated digit by digit rather than by building one huge
 * integer: a 20-digit reference overflows a double long before Number can divide
 * it, and the silently-wrong checksum that produces is worse than no checksum.
 */
export function mod97CheckDigits(digits: string): string {
  if (!/^[0-9]+$/.test(digits)) throw new Error("mod97CheckDigits: digits only");
  // Appending "00" is what makes the result the digits that COMPLETE the number
  // to a multiple of 97, rather than just its remainder.
  let remainder = 0;
  for (const ch of `${digits}00`) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  const check = 98 - remainder;
  return String(check).padStart(2, "0");
}

/** Strip a document number down to the digits a bank field will accept, keeping
 *  the year and sequence that make it unique: TZ-2026-0007 -> 20260007. */
export function referenceDigits(source: string): string {
  const digits = source.replace(/\D/g, "");
  // Truncate from the RIGHT so the sequence survives: the tail is what
  // distinguishes two documents, the leading year is shared by all of them.
  // 20 characters total, two of which are the check digits.
  return digits.slice(-18) || "0";
}

/** The value to print, given the issuer's chosen model. Returns null for "none",
 *  where the caller prints the document number as the payment purpose instead. */
export function paymentReferenceFor(
  documentNumber: string,
  model: ReferenceModel,
): string | null {
  if (model !== "97") return null;
  const body = referenceDigits(documentNumber);
  return `${mod97CheckDigits(body)}${body}`;
}

export type SellerPaymentAccounts = {
  domestic?: string | null;
  eur?: string | null;
  usd?: string | null;
  legacyForeign?: string | null;
};

function normalizedAccount(value: string | null | undefined) {
  return value?.trim() || null;
}

export function paymentAccountForCurrency(
  currency: string,
  accounts: SellerPaymentAccounts,
) {
  const code = currency.trim().toUpperCase();

  if (code === "RSD") {
    return (
      normalizedAccount(accounts.domestic) ??
      normalizedAccount(accounts.legacyForeign) ??
      normalizedAccount(accounts.eur)
    );
  }

  if (code === "EUR") {
    return normalizedAccount(accounts.eur) ?? normalizedAccount(accounts.legacyForeign);
  }

  if (code === "USD") {
    return normalizedAccount(accounts.usd);
  }

  return normalizedAccount(accounts.legacyForeign) ?? normalizedAccount(accounts.eur);
}

/**
 * Which account the buyer actually pays into.
 *
 * A domestic invoice settles in DINARS whatever it is denominated in. Two Serbian
 * residents may agree a price in euros — the currency clause is ordinary — but
 * the payment between them is a dinar payment, so printing the foreign-currency
 * account on a domestic document points the buyer at a transfer they should not
 * be making. The euro figure stays as the invoiced amount and the dinar
 * equivalent, already computed at the NBS middle rate, is what gets transferred.
 *
 * Foreign buyers are unaffected: they pay the currency of the invoice.
 */
export function settlementAccount(
  scope: "domestic" | "foreign",
  currency: string,
  accounts: SellerPaymentAccounts,
): string | null {
  return paymentAccountForCurrency(scope === "domestic" ? "RSD" : currency, accounts);
}

/**
 * Today in Belgrade, as YYYY-MM-DD plus the year.
 *
 * Both the invoice date and the number series were taken from the server clock,
 * which on Vercel is UTC. Serbia runs UTC+1/+2, so anything issued between
 * midnight and 01:00 or 02:00 local was dated to the PREVIOUS day — and across
 * New Year to the previous year, which puts the document in the wrong sequence
 * as well as on the wrong date. A tax document's date is not something to leave
 * to where the function happened to execute.
 */
export function belgradeToday(now = new Date()): { iso: string; year: number } {
  // en-CA is the locale that formats as YYYY-MM-DD, which is why it is used here
  // rather than assembling the parts by hand.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { iso, year: Number(iso.slice(0, 4)) };
}

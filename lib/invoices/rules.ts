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

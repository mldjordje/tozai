export type InvoiceKind = "proforma" | "invoice";

export function invoiceNumber(
  kind: InvoiceKind,
  year: number,
  sequence: number,
): string {
  const prefix = kind === "proforma" ? "PR" : "TZ";
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function invoiceScope(
  country: string | null | undefined,
): "domestic" | "foreign" {
  const value = country?.trim().toUpperCase();
  if (!value) return "domestic";
  return value === "RS" || value === "SRB" || value === "SRBIJA" || value === "SERBIA"
    ? "domestic"
    : "foreign";
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

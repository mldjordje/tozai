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

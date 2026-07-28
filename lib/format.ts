// Display helpers shared by the client dashboard. Serbian locale throughout —
// the whole customer-facing surface is sr-RS.

export function formatMoney(amount: number, currency = "EUR") {
  return `${amount.toLocaleString("sr-RS", { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sr-RS", { day: "2-digit", month: "long", year: "numeric" });
}

const MONTHS_SR = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
];

// Calendar days (booking dates, project deadlines) are date-only values with no
// time and no zone. Parsing them through `new Date()` puts them at UTC midnight,
// which renders as the previous day for anyone west of Greenwich — so format the
// string directly instead. Queries must select these as `col::text`.
export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return formatDate(value);
  const [, year, month, day] = match;
  return `${day}. ${MONTHS_SR[Number(month) - 1]} ${year}.`;
}

export function formatDateShort(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// "1 sat" / "2 sata" / "5 sati" — Serbian has three forms, keyed on the last
// digit, with the teens as the exception (12 is "sati", not "sata"). Fractions
// take the plural: "1,5 sati".
export function formatHours(hours: number) {
  const rounded = Math.round(hours * 100) / 100;
  const value = rounded.toLocaleString("sr-RS", { maximumFractionDigits: 2 });
  if (!Number.isInteger(rounded)) return `${value} sati`;
  const whole = Math.abs(rounded) % 100;
  const last = whole % 10;
  const teen = whole >= 11 && whole <= 14;
  const word = teen ? "sati" : last === 1 ? "sat" : last >= 2 && last <= 4 ? "sata" : "sati";
  return `${value} ${word}`;
}

/* ------------------------------------------------------------------ status --- */

export const PROJECT_STATUS_FLOW = [
  "onboarding",
  "u_izradi",
  "na_reviziji",
  "isporuceno",
] as const;

/** Statuses after which nothing more is expected from the client. Mirrored in
 *  the materials route so the form and the API agree on when hand-off closes. */
export const PROJECT_CLOSED = ["isporuceno", "otkazano"];

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  u_izradi: "U izradi",
  na_reviziji: "Na reviziji",
  isporuceno: "Isporučeno",
  otkazano: "Otkazano",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Čeka uplatu",
  paid: "Plaćeno",
  cancelled: "Otkazano",
  refunded: "Refundirano",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  zakazano: "Zakazano",
  odrzano: "Održano",
  otkazano: "Otkazano",
};

export const HOUR_KIND_LABEL: Record<string, string> = {
  education: "Edukacija",
  consulting: "Consulting",
};

// Tone drives the badge colour: neutral (waiting), live (in flight), done, bad.
export type StatusTone = "neutral" | "live" | "done" | "bad";

export function projectTone(status: string): StatusTone {
  if (status === "isporuceno") return "done";
  if (status === "otkazano") return "bad";
  if (status === "onboarding") return "neutral";
  return "live";
}

export function orderTone(status: string): StatusTone {
  if (status === "paid") return "done";
  if (status === "cancelled" || status === "refunded") return "bad";
  return "neutral";
}

export function bookingTone(status: string): StatusTone {
  if (status === "odrzano") return "done";
  if (status === "otkazano") return "bad";
  return "live";
}

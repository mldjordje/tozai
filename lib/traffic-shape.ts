// Pure shaping for the Vercel Web Analytics responses — no fetch, no env, no
// server-only, so it is unit-testable. lib/traffic.ts owns the credentials and
// the network; everything that interprets a payload lives here.
//
// The readers are deliberately paranoid. This code is written against a
// documented response shape rather than against a call we can make in
// development, so an unexpected payload has to degrade to an empty row or a zero
// — never to a crash inside the admin panel or to NaN in a chart.

export type TrafficPoint = { date: string; pageviews: number; visitors: number };
export type TrafficRow = { label: string; pageviews: number; visitors: number };

/** Ranges the panel offers. Fixed set, not a free number: `days` is interpolated
 *  into an upstream query, and a whitelist means no arithmetic on user input can
 *  reach it. */
export const ALLOWED_DAYS = [7, 30, 90];
export const DEFAULT_DAYS = 30;

export function pickDays(raw: unknown): number {
  const n = Number(raw);
  return ALLOWED_DAYS.includes(n) ? n : DEFAULT_DAYS;
}

export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive window ending today, which is why the span is days - 1: a "7 dana"
 *  range that subtracted a full 7 would cover eight dates. */
export function rangeFor(days: number, now = new Date()): { since: string; until: string } {
  const since = new Date(now.getTime() - (days - 1) * 86_400_000);
  return { since: isoDate(since), until: isoDate(now) };
}

/** Aggregate rows carry their dimension under a key named after the `by` value
 *  that produced them, plus the two metrics. An absent or blank dimension becomes
 *  `fallback` rather than a row with no label. */
export function toRows(json: unknown, dimension: string, fallback: string): TrafficRow[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const value = row[dimension];
    const label = typeof value === "string" && value.trim() ? value : fallback;
    return { label, pageviews: num(row.pageviews), visitors: num(row.visitors) };
  });
}

/** `by=day` rows are keyed on `timestamp`, an ISO instant. Sorted here rather
 *  than trusted, because the chart reads them positionally. */
export function toDaily(json: unknown): TrafficPoint[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      const date = typeof row.timestamp === "string" ? row.timestamp.slice(0, 10) : "";
      return { date, pageviews: num(row.pageviews), visitors: num(row.visitors) };
    })
    .filter((point) => point.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function sumPoints(points: TrafficPoint[]): { pageviews: number; visitors: number } {
  return {
    pageviews: points.reduce((sum, p) => sum + p.pageviews, 0),
    visitors: points.reduce((sum, p) => sum + p.visitors, 0),
  };
}

/** The lifetime count payload, or null when the endpoint was skipped or refused. */
export function toLifetime(json: unknown): { pageviews: number; visitors: number } | null {
  const data = (json as { data?: unknown } | null)?.data;
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.pageviews === undefined && row.visitors === undefined) return null;
  return { pageviews: num(row.pageviews), visitors: num(row.visitors) };
}

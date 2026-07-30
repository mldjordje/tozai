import "server-only";
import {
  rangeFor,
  sumPoints,
  toDaily,
  toLifetime,
  toRows,
  type TrafficPoint,
  type TrafficRow,
} from "./traffic-shape";

// Vercel Web Analytics, read back into the admin panel.
//
// The panel's own "Analitika" tab reports what the DATABASE knows: orders,
// revenue, clients. None of that says how many people saw the site — that data
// lives in Vercel and, until now, only in Vercel's dashboard, on an account the
// owner has to switch into. This pulls it over the public Web Analytics API so
// traffic and sales can be read side by side.
//
// Read-only, server-only, and behind /api/admin (middleware.ts gates the whole
// prefix on a staff session). The access token never reaches the browser.

const BASE = "https://api.vercel.com/v1/query/web-analytics";

/** How long to give Vercel before giving up. The admin tab renders the rest of
 *  the page while this is in flight, so a stalled upstream must not hold it. */
const TIMEOUT_MS = 9000;

export type { TrafficPoint, TrafficRow };

export type TrafficReport = {
  since: string;
  until: string;
  /** Window total, summed from `daily` so it can never disagree with the chart. */
  totals: { pageviews: number; visitors: number };
  /** All-time production total. Null when the count endpoint refused — the rest
   *  of the report is still worth showing. */
  lifetime: { pageviews: number; visitors: number } | null;
  daily: TrafficPoint[];
  routes: TrafficRow[];
  referrers: TrafficRow[];
  countries: TrafficRow[];
  devices: TrafficRow[];
};

export type TrafficResult =
  | { ok: true; report: TrafficReport }
  /** Nothing is wrong — the credentials were never set. Named separately so the
   *  panel can print instructions instead of an error. */
  | { ok: false; reason: "unconfigured"; missing: string[] }
  | { ok: false; reason: "error"; message: string };

type Config = { token: string; projectId: string; teamId?: string };

/**
 * Credentials, from the environment.
 *
 * Vercel reserves the `VERCEL_` prefix for its own system variables and refuses
 * to create custom ones under it, so these carry local names. The project id is
 * the exception: Vercel injects `VERCEL_PROJECT_ID` into the deployment itself,
 * so it is taken as a fallback and only has to be set by hand for local runs.
 *
 * A team id is required for team-owned projects and must be ABSENT for ones
 * owned by a personal account — so it is optional here rather than defaulted.
 */
function readConfig(): Config | { missing: string[] } {
  const token = process.env.WEB_ANALYTICS_TOKEN?.trim();
  const projectId = (
    process.env.WEB_ANALYTICS_PROJECT_ID ||
    process.env.VERCEL_PROJECT_ID ||
    ""
  ).trim();
  const teamId = process.env.WEB_ANALYTICS_TEAM_ID?.trim();

  const missing: string[] = [];
  if (!token) missing.push("WEB_ANALYTICS_TOKEN");
  if (!projectId) missing.push("WEB_ANALYTICS_PROJECT_ID");
  if (missing.length) return { missing };
  return { token: token!, projectId, teamId: teamId || undefined };
}

/** One Web Analytics query. Throws with Vercel's own message on a non-2xx so the
 *  panel can show the real reason — a bad token and an out-of-window date range
 *  are very different problems and both are actionable. */
async function query(
  cfg: Config,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<unknown> {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("projectId", cfg.projectId);
  if (cfg.teamId) url.searchParams.set("teamId", cfg.teamId);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // The token travels in a header, never in the URL or the body, so nothing
    // here can leak it into a log or into the panel.
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? "";
    } catch {
      detail = "";
    }
    throw new Error(`Vercel ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

/**
 * The whole traffic report for the last `days` days.
 *
 * Six queries, issued together — five aggregates plus the lifetime count. The
 * count is allowed to fail on its own: aggregate endpoints are bounded by the
 * plan's reporting window while the count endpoint is not, so they do not
 * necessarily succeed or fail together and losing one number is no reason to
 * show the panel nothing.
 */
export async function getTrafficReport(days: number): Promise<TrafficResult> {
  const cfg = readConfig();
  if ("missing" in cfg) return { ok: false, reason: "unconfigured", missing: cfg.missing };

  const range = rangeFor(days);

  try {
    const [daily, routes, referrers, countries, devices, lifetime] = await Promise.all([
      query(cfg, "visits/aggregate", { ...range, by: "day" }),
      query(cfg, "visits/aggregate", { ...range, by: "route", limit: 10 }),
      query(cfg, "visits/aggregate", { ...range, by: "referrerHostname", limit: 8 }),
      query(cfg, "visits/aggregate", { ...range, by: "country", limit: 8 }),
      query(cfg, "visits/aggregate", { ...range, by: "deviceType", limit: 5 }),
      query(cfg, "visits/count", {}).catch(() => null),
    ]);

    const points = toDaily(daily);

    return {
      ok: true,
      report: {
        ...range,
        totals: sumPoints(points),
        lifetime: toLifetime(lifetime),
        daily: points,
        routes: toRows(routes, "route", "—"),
        // An empty referrer is direct traffic, which is a real and usually large
        // row — labelling it "—" would read as missing data.
        referrers: toRows(referrers, "referrerHostname", "Direktno"),
        countries: toRows(countries, "country", "—"),
        devices: toRows(devices, "deviceType", "—"),
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

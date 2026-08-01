// The web / app / automation brief (grp='razvoj', flow='build').
//
// Deliberately free of `server-only` and of any React import: the form, the
// write route and the admin panel all need these, and they run in three
// different places. Anything that touches the database lives in
// lib/video-requests.ts, which is where these rows are stored — see the note on
// `kind` in scripts/init-db.mjs for why the two briefs share one table.

export const TIMEFRAMES = ["asap", "1-3m", "3-6m", "flex"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && (TIMEFRAMES as readonly string[]).includes(value);
}

/** What the studio reads in the admin panel and in the notification mail. The
 *  buyer's own wording is in the form; this is the Serbian label for the value
 *  that was stored, in one place so the two can never drift. */
export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  asap: "Što pre — hitno",
  "1-3m": "1–3 meseca",
  "3-6m": "3–6 meseci",
  flex: "Fleksibilno",
};

/**
 * The answers that are specific to a build brief.
 *
 * Stored in `video_requests.brief` rather than as columns because they are
 * free-form and only this one kind of request has them — which is exactly what
 * a JSONB column is for. `idea` is shared with the video brief, so a reader
 * that only knows about `idea` keeps working on both kinds.
 */
export type BuildBrief = {
  idea: string;
  /** Optional extras the buyer listed. Empty string when they skipped it. */
  wishes: string;
  timeframe: Timeframe;
};

export function isBuildBrief(value: unknown): value is BuildBrief {
  if (typeof value !== "object" || value === null) return false;
  const brief = value as Record<string, unknown>;
  return typeof brief.idea === "string" && isTimeframe(brief.timeframe);
}

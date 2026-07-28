// Pure slot math, shared by the server booking logic and the buyer's calendar.
//
// Deliberately free of `server-only` and of any DB import: the client has to be
// able to answer "does this start time still have N free hours behind it?" with
// exactly the rule the API enforces, otherwise the calendar offers slots the
// server then rejects.

export const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A single session is capped so one booking cannot swallow a whole day. */
export const MAX_BOOKING_HOURS = 4;

/** How long before the start the buyer may still cancel and get the hours back. */
export const CANCEL_CUTOFF_HOURS = 24;

export function slotToMinutes(slot: string): number | null {
  if (!SLOT_PATTERN.test(slot)) return null;
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToSlot(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The consecutive hourly slots a booking of `hours` occupies, or null when the
 * request is malformed or would run past midnight.
 */
export function slotSequence(startSlot: string, hours: number): string[] | null {
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_BOOKING_HOURS) return null;
  const start = slotToMinutes(startSlot);
  if (start === null) return null;
  const out: string[] = [];
  for (let i = 0; i < hours; i += 1) {
    const minutes = start + i * 60;
    if (minutes > 23 * 60) return null;
    out.push(minutesToSlot(minutes));
  }
  return out;
}

/** Start times out of `free` that have `hours` consecutive free slots behind them. */
export function startsFor(free: string[], hours: number): string[] {
  const open = new Set(free);
  return free
    .filter((slot) => {
      const seq = slotSequence(slot, hours);
      return seq !== null && seq.every((s) => open.has(s));
    })
    .sort();
}

export type WallClock = { date: string; minutes: number };

/**
 * Belgrade wall clock. The studio, the buyers and the slot strings all live in
 * one timezone; the server does not (Vercel runs UTC), so it is read explicitly
 * instead of trusting the runtime's local time.
 */
export function belgradeNow(at: Date = new Date()): WallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24; // en-CA can render midnight as "24"
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

/**
 * Minutes between `now` and a (date, slot) pair, both read as Belgrade wall
 * clock. Date-only values carry no zone, so they are compared as calendar days
 * rather than parsed into instants — the same reasoning as `formatDay()`.
 * Negative means the slot is already in the past.
 */
export function minutesUntil(date: string, slot: string, now: WallClock): number | null {
  const start = slotToMinutes(slot);
  if (start === null) return null;
  const day = dayNumber(date);
  const today = dayNumber(now.date);
  if (day === null || today === null) return null;
  return (day - today) * 1440 + (start - now.minutes);
}

function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  return Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000);
}

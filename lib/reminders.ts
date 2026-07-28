import "server-only";
import { getSql } from "@/lib/db";
import { queueStudioNotice } from "@/lib/email";
import { formatDay, formatHours, HOUR_KIND_LABEL } from "@/lib/format";
import { belgradeNow, minutesUntil } from "@/lib/booking-slots";

// The hour-before nudge for the studio.
//
// Nothing in the app runs on a timer by itself, so this is driven from outside:
// /api/cron/podsetnici is pinged every few minutes and calls in here. The two
// consequences of that shape are what the code below is built around.
//
// LATE RUNS ARE NORMAL. A ping can be missed — a cold start, a deploy, a
// provider hiccup — so the rule is not "exactly 60 minutes before" but "the
// session starts within the next hour and nobody has been told yet". A reminder
// that arrives 40 minutes before still does its job; one that never arrives
// because the 60-minute mark was missed by a run does not.
//
// OVERLAPPING RUNS ARE POSSIBLE. `reminded_1h` is claimed with a guarded UPDATE
// *before* the mail is queued, so two runs that see the same booking cannot both
// send. Claim-then-send can lose a reminder if the queue call dies right after
// the claim; send-then-claim would send twice, every time. The first failure is
// rarer and quieter.

/** How far ahead a session has to be to still count as "coming up". */
const LEAD_MINUTES = 60;

type DueBooking = {
  id: number;
  kind: string;
  date: string;
  start_slot: string;
  hours: number;
  topic: string | null;
  meet_url: string | null;
  user_name: string | null;
  user_email: string | null;
};

export type ReminderRun = {
  /** Sessions inside the window that had not been announced yet. */
  due: number;
  /** Of those, the ones this run actually claimed and mailed. */
  sent: number;
};

/**
 * Notify the studio about every session starting within the next hour.
 *
 * Safe to call as often as the schedule allows: a booking is announced once and
 * only once, and a run with nothing due is a single SELECT.
 */
export async function sendUpcomingSessionReminders(
  baseUrl?: string,
): Promise<ReminderRun> {
  const sql = getSql();

  // Two calendar days around today, then filtered in JS: `date` is a bare day
  // and `start_slot` a "HH:MM" string, so the actual "how far away is this"
  // question is Belgrade wall-clock math, not something SQL can answer without
  // reconstructing the same timezone rules.
  const rows = (await sql`
    SELECT b.id, b.kind, b.date::text AS date, b.start_slot, b.hours::float8 AS hours,
           b.topic, b.meet_url, u.name AS user_name, u.email AS user_email
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.status = 'zakazano'
      AND b.reminded_1h = false
      AND b.date BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 1
    ORDER BY b.date, b.start_slot
  `) as DueBooking[];

  const now = belgradeNow();
  const due = rows.filter((booking) => {
    const left = minutesUntil(booking.date, booking.start_slot, now);
    return left !== null && left > 0 && left <= LEAD_MINUTES;
  });

  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  let sent = 0;

  for (const booking of due) {
    const claimed = (await sql`
      UPDATE bookings SET reminded_1h = true
      WHERE id = ${booking.id} AND reminded_1h = false
      RETURNING id
    `) as { id: number }[];
    if (claimed.length === 0) continue;

    const left = minutesUntil(booking.date, booking.start_slot, now) ?? 0;
    const kind = HOUR_KIND_LABEL[booking.kind] ?? booking.kind;

    await queueStudioNotice({
      templateKey: "studio_session_soon",
      subject: `Za ${left} min — ${kind}, ${booking.start_slot}`,
      body: [
        `${kind} počinje u ${booking.start_slot} (${formatDay(booking.date)}).`,
        `Klijent: ${booking.user_name ?? "—"} (${booking.user_email ?? "—"})`,
        `Trajanje: ${formatHours(booking.hours)}`,
        booking.topic ? `Tema: ${booking.topic}` : null,
        "",
        booking.meet_url ? `Link: ${booking.meet_url}` : "Link još nije zakazan.",
        "",
        `${base}/admin/termini`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });
    sent += 1;
  }

  return { due: due.length, sent };
}

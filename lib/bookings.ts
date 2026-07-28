import "server-only";
import { getSql } from "@/lib/db";
import { queueQuietly, queueStudioNotice } from "@/lib/email";
import { formatDay, formatHours, HOUR_KIND_LABEL } from "@/lib/format";
import { createMeetEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import {
  belgradeNow,
  CANCEL_CUTOFF_HOURS,
  MAX_BOOKING_HOURS,
  minutesUntil,
  slotSequence,
  SLOT_PATTERN,
} from "@/lib/booking-slots";

// Booking a session against the hour wallet.
//
// The grid is the one the studio fills in on /admin/dostupnost:
// `availability_days.slots` holds one "HH:MM" per bookable hour. A session of N
// hours therefore occupies N consecutive slots, and every one of them has to be
// both open and free.
//
// DOUBLE BOOKING is prevented by the PRIMARY KEY (date, slot) on
// `booking_slots`, never by checking first — two buyers hitting the same free
// slot in the same second would both pass a check and both insert. Here the
// second one loses the INSERT and its booking row is rolled back by hand,
// because the Neon HTTP driver has no interactive transaction.
//
// HOURS are a ledger (`hour_entries`), so a booking is a negative row and a
// cancellation a positive one. Balance is always SUM(hours) — never a counter
// that could drift.

export type BookingKind = "education" | "consulting";

export type Booking = {
  id: number;
  kind: string;
  date: string;
  start_slot: string;
  hours: number;
  status: string;
  topic: string | null;
  meet_url?: string | null;
  /** Calendar event behind the Meet room, so cancelling can take it down. */
  gcal_event_id?: string | null;
};

export type BookingFailure =
  | "invalid"
  | "past"
  | "closed"
  | "taken"
  | "balance"
  | "not_found"
  | "too_late";

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: BookingFailure; message: string };

export type AvailableDay = { date: string; slots: string[] };

function isMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return { start: `${month}-01`, end: next.toISOString().slice(0, 10) };
}

/**
 * Open slots per day for a month, with everything already booked — and every
 * hour that has already passed today — removed. This is what the buyer sees;
 * the admin view (`/api/admin/availability`) deliberately shows the raw
 * schedule instead, including days that are fully booked.
 */
export async function getAvailableMonth(month: string): Promise<AvailableDay[]> {
  if (!isMonth(month)) return [];
  const { start, end } = monthRange(month);
  const sql = getSql();
  const rows = (await sql`
    SELECT to_char(a.date, 'YYYY-MM-DD') AS date,
           a.slots,
           COALESCE(
             ARRAY(SELECT bs.slot FROM booking_slots bs WHERE bs.date = a.date),
             '{}'
           ) AS taken
    FROM availability_days a
    WHERE a.date >= ${start} AND a.date < ${end}
    ORDER BY a.date
  `) as { date: string; slots: string[]; taken: string[] }[];

  const now = belgradeNow();
  const days: AvailableDay[] = [];
  for (const row of rows) {
    if (row.date < now.date) continue;
    const taken = new Set(row.taken);
    const free = row.slots
      .filter((slot) => SLOT_PATTERN.test(slot) && !taken.has(slot))
      .filter((slot) => (minutesUntil(row.date, slot, now) ?? -1) > 0)
      .sort();
    if (free.length > 0) days.push({ date: row.date, slots: free });
  }
  return days;
}

export async function getBalance(userId: number, kind: BookingKind): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COALESCE(SUM(hours), 0)::float8 AS remaining
    FROM hour_entries WHERE user_id = ${userId} AND kind = ${kind}
  `) as { remaining: number }[];
  return rows[0]?.remaining ?? 0;
}

export type BookingInput = {
  date: string;
  startSlot: string;
  hours: number;
  kind: BookingKind;
  topic?: string | null;
};

/**
 * Reserve a session. Every failure mode returns a code rather than throwing, so
 * the route can turn "someone took this slot while you were choosing" into a
 * 409 the calendar knows how to recover from.
 */
export async function createBooking(
  userId: number,
  input: BookingInput,
  options: { baseUrl?: string } = {},
): Promise<BookingResult> {
  const { date, startSlot, kind } = input;
  const hours = Number(input.hours);
  const topic = typeof input.topic === "string" ? input.topic.trim().slice(0, 300) || null : null;

  if (!isDate(date) || !SLOT_PATTERN.test(startSlot)) {
    return { ok: false, code: "invalid", message: "Neispravan termin." };
  }
  if (kind !== "education" && kind !== "consulting") {
    return { ok: false, code: "invalid", message: "Neispravan tip sesije." };
  }
  const sequence = slotSequence(startSlot, hours);
  if (!sequence) {
    return {
      ok: false,
      code: "invalid",
      message: `Trajanje mora biti ceo broj sati, najviše ${MAX_BOOKING_HOURS}.`,
    };
  }

  const now = belgradeNow();
  if ((minutesUntil(date, startSlot, now) ?? -1) <= 0) {
    return { ok: false, code: "past", message: "Taj termin je već prošao." };
  }

  const sql = getSql();

  // Open hours and taken hours in one read. The taken set is advisory here —
  // the PK on booking_slots is what actually decides — but reading it lets the
  // common case fail with a useful message instead of a rollback.
  const dayRows = (await sql`
    SELECT a.slots,
           COALESCE(ARRAY(SELECT bs.slot FROM booking_slots bs WHERE bs.date = ${date}), '{}') AS taken
    FROM availability_days a WHERE a.date = ${date}
  `) as { slots: string[]; taken: string[] }[];
  const day = dayRows[0];
  if (!day) {
    return { ok: false, code: "closed", message: "Taj dan nije otvoren za termine." };
  }
  const open = new Set(day.slots);
  if (!sequence.every((slot) => open.has(slot))) {
    return {
      ok: false,
      code: "closed",
      message: "Izabrano trajanje ne staje u otvorene termine tog dana.",
    };
  }
  const taken = new Set(day.taken);
  if (sequence.some((slot) => taken.has(slot))) {
    return { ok: false, code: "taken", message: "Termin je u međuvremenu zauzet." };
  }

  const balance = await getBalance(userId, kind);
  if (balance < hours) {
    return {
      ok: false,
      code: "balance",
      message: `Na stanju imaš ${formatHours(balance)} — nedovoljno za ovaj termin.`,
    };
  }

  const created = (await sql`
    INSERT INTO bookings (user_id, kind, date, start_slot, hours, status, topic)
    VALUES (${userId}, ${kind}, ${date}, ${startSlot}, ${hours}, 'zakazano', ${topic})
    RETURNING id
  `) as { id: number }[];
  const bookingId = created[0]?.id;
  if (!bookingId) {
    return { ok: false, code: "invalid", message: "Termin nije sačuvan." };
  }

  // The claim. Partial success means someone else holds one of the hours, so
  // the whole booking is undone — booking_slots cascades on delete.
  const claimed = (await sql`
    INSERT INTO booking_slots (booking_id, date, slot)
    SELECT ${bookingId}, ${date}::date, s FROM unnest(${sequence}::text[]) AS s
    ON CONFLICT (date, slot) DO NOTHING
    RETURNING slot
  `) as { slot: string }[];
  if (claimed.length !== sequence.length) {
    await sql`DELETE FROM bookings WHERE id = ${bookingId}`;
    return { ok: false, code: "taken", message: "Termin je upravo zauzet. Izaberi drugi." };
  }

  await sql`
    INSERT INTO hour_entries (user_id, kind, hours, reason, booking_id, note)
    VALUES (${userId}, ${kind}, ${-hours}, 'booking', ${bookingId},
            ${`termin ${date} ${startSlot}`})
  `;

  // Balance is re-read after the debit, not before: two bookings started at the
  // same moment can both see enough hours and only the ledger knows the truth.
  const after = await getBalance(userId, kind);
  if (after < 0) {
    await sql`DELETE FROM hour_entries WHERE booking_id = ${bookingId} AND reason = 'booking'`;
    await sql`DELETE FROM bookings WHERE id = ${bookingId}`;
    return { ok: false, code: "balance", message: "Nemaš dovoljno sati na stanju." };
  }

  // The Meet room. Deliberately after the booking is committed and never
  // allowed to fail it: if Google is down the buyer keeps the session and the
  // studio sees "Bez linka" in the panel, which is recoverable. Losing the
  // booking because a third party had a bad minute is not.
  const meet = await createMeetForBooking({
    bookingId,
    userId,
    kind,
    date,
    startSlot,
    hours,
    topic,
  });

  await notifyBooked(
    userId,
    {
      id: bookingId,
      kind,
      date,
      start_slot: startSlot,
      hours,
      status: "zakazano",
      topic,
    },
    options.baseUrl,
    meet,
  );

  return {
    ok: true,
    booking: {
      id: bookingId,
      kind,
      date,
      start_slot: startSlot,
      hours,
      status: "zakazano",
      topic,
      meet_url: meet,
    },
  };
}

/**
 * Open the Meet room for a booking and record it. Returns the link, or null
 * when the calendar is not connected or Google refused — every caller treats
 * that as "no link yet", not as an error.
 */
export async function createMeetForBooking(input: {
  bookingId: number;
  userId: number;
  kind: string;
  date: string;
  startSlot: string;
  hours: number;
  topic: string | null;
}): Promise<string | null> {
  const sql = getSql();
  const buyers = (await sql`
    SELECT email, name FROM users WHERE id = ${input.userId}
  `) as { email: string; name: string | null }[];
  const buyer = buyers[0];

  const event = await createMeetEvent({
    bookingId: input.bookingId,
    date: input.date,
    startSlot: input.startSlot,
    hours: input.hours,
    summary: `TOZA AI — ${HOUR_KIND_LABEL[input.kind] ?? input.kind}${
      buyer?.name ? ` · ${buyer.name}` : ""
    }`,
    description: [
      input.topic ? `Tema: ${input.topic}` : null,
      buyer?.email ? `Klijent: ${buyer.email}` : null,
      `Termin #${input.bookingId} · ${formatHours(input.hours)}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    attendeeEmail: buyer?.email ?? null,
  });
  if (!event) return null;

  await sql`
    UPDATE bookings
    SET meet_url = ${event.meetUrl}, gcal_event_id = ${event.eventId}
    WHERE id = ${input.bookingId}
  `;
  return event.meetUrl;
}

/**
 * Give the slot and the hours back. Scoped by user_id, and the status guard on
 * the UPDATE is what makes a double-click harmless: only the caller that
 * actually flips `zakazano` → `otkazano` refunds.
 */
export async function cancelBooking(
  userId: number,
  bookingId: number,
): Promise<BookingResult> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, kind, date::text AS date, start_slot, hours::float8 AS hours, status, topic,
           meet_url, gcal_event_id
    FROM bookings WHERE id = ${bookingId} AND user_id = ${userId}
  `) as Booking[];
  const booking = rows[0];
  if (!booking) {
    return { ok: false, code: "not_found", message: "Termin nije pronađen." };
  }
  if (booking.status !== "zakazano") {
    return { ok: false, code: "not_found", message: "Termin je već zatvoren." };
  }

  const left = minutesUntil(booking.date, booking.start_slot, belgradeNow()) ?? -1;
  if (left < CANCEL_CUTOFF_HOURS * 60) {
    return {
      ok: false,
      code: "too_late",
      message: `Otkazivanje je moguće najkasnije ${CANCEL_CUTOFF_HOURS}h pre termina. Javi nam se direktno.`,
    };
  }

  const released = await releaseBooking(booking, userId, true);
  if (!released) {
    return { ok: false, code: "not_found", message: "Termin je već zatvoren." };
  }

  await queueStudioNotice({
    templateKey: "studio_booking_canceled",
    subject: `Otkazan termin — ${booking.date} ${booking.start_slot}`,
    body: [
      `Klijent #${userId} je otkazao termin.`,
      `${formatDay(booking.date)} u ${booking.start_slot} · ${formatHours(booking.hours)}`,
      `Sati su vraćeni na wallet (${HOUR_KIND_LABEL[booking.kind] ?? booking.kind}).`,
    ].join("\n"),
  });

  return { ok: true, booking: { ...booking, status: "otkazano" } };
}

/**
 * Flip a booking to `otkazano`, free its slots and — unless the studio decides
 * the session is being written off — put the hours back.
 *
 * The status guard on the UPDATE is the whole safety mechanism: only the caller
 * that actually performs the transition gets to refund, so a double-click or a
 * buyer and the studio cancelling at the same moment cannot credit twice. The
 * refund insert carries its own NOT EXISTS guard for the same reason.
 */
async function releaseBooking(
  booking: Booking,
  userId: number,
  refund: boolean,
): Promise<boolean> {
  const sql = getSql();
  const closed = (await sql`
    UPDATE bookings SET status = 'otkazano'
    WHERE id = ${booking.id} AND status = 'zakazano'
    RETURNING id
  `) as { id: number }[];
  if (closed.length === 0) return false;

  // Free the slot before crediting: a refunded wallet with a still-blocked hour
  // is the worse of the two half-finished states.
  await sql`DELETE FROM booking_slots WHERE booking_id = ${booking.id}`;
  // Take the room down too, so neither side is left with a live Meet link for
  // a session that is not happening. Best effort — a stale calendar entry must
  // not hold up the refund.
  if (booking.gcal_event_id) {
    await deleteCalendarEvent(booking.gcal_event_id);
    await sql`UPDATE bookings SET meet_url = NULL, gcal_event_id = NULL WHERE id = ${booking.id}`;
  }
  if (refund) {
    await sql`
      INSERT INTO hour_entries (user_id, kind, hours, reason, booking_id, note)
      SELECT ${userId}, ${booking.kind}, ${booking.hours}, 'refund', ${booking.id},
             ${`otkazan termin ${booking.date} ${booking.start_slot}`}
      WHERE NOT EXISTS (
        SELECT 1 FROM hour_entries WHERE booking_id = ${booking.id} AND reason = 'refund'
      )
    `;
  }
  return true;
}

/**
 * The studio cancels. No cutoff — the 24h rule exists to protect the studio's
 * calendar from last-minute buyer changes, not to stop the studio itself.
 * `refund` is a choice here: a no-show that is being charged keeps the hours
 * spent, and the panel says which one happened.
 */
export async function cancelBookingAsStudio(
  bookingId: number,
  options: { refund?: boolean; reason?: string | null; baseUrl?: string } = {},
): Promise<BookingResult> {
  const sql = getSql();
  const rows = (await sql`
    SELECT b.id, b.user_id, b.kind, b.date::text AS date, b.start_slot,
           b.hours::float8 AS hours, b.status, b.topic, b.meet_url, b.gcal_event_id,
           u.email AS user_email, u.name AS user_name
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.id = ${bookingId}
  `) as (Booking & { user_id: number; user_email: string | null; user_name: string | null })[];
  const booking = rows[0];
  if (!booking) return { ok: false, code: "not_found", message: "Termin nije pronađen." };
  if (booking.status !== "zakazano") {
    return { ok: false, code: "not_found", message: "Termin je već zatvoren." };
  }

  const refund = options.refund !== false;
  const released = await releaseBooking(booking, booking.user_id, refund);
  if (!released) return { ok: false, code: "not_found", message: "Termin je već zatvoren." };

  if (booking.user_email) {
    const base = options.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    await queueQuietly({
      userId: booking.user_id,
      recipient: booking.user_email,
      templateKey: "booking_canceled",
      subject: `Otkazan termin — ${formatDay(booking.date)} u ${booking.start_slot}`,
      body: [
        `Zdravo ${booking.user_name?.split(" ")[0] ?? ""},`,
        "",
        `Termin ${formatDay(booking.date)} u ${booking.start_slot} je otkazan.`,
        options.reason ? `Razlog: ${options.reason}` : null,
        refund
          ? `Vraćeno ti je ${formatHours(booking.hours)} na stanje — izaberi novi termin:`
          : "Novi termin biraš ovde:",
        `${base}/nalog/edukacija`,
        "",
        "TOZA AI",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });
  }

  return { ok: true, booking: { ...booking, status: "otkazano" } };
}

/**
 * Attach the meeting link and tell the client it is there.
 *
 * The link is pasted by the studio rather than generated: creating a Google
 * Meet room needs a Calendar API token for the studio account, and the Google
 * OAuth credentials are still missing (see docs/PLAN — EPIC 0.2). The
 * `gcal_event_id` column is already in place for when they arrive; until then
 * this is the whole flow, and the client is not left waiting on a link that
 * nothing produces.
 */
export async function setBookingMeetUrl(
  bookingId: number,
  meetUrl: string | null,
  options: { baseUrl?: string; notify?: boolean } = {},
): Promise<BookingResult> {
  const sql = getSql();
  const rows = (await sql`
    SELECT b.id, b.user_id, b.kind, b.date::text AS date, b.start_slot,
           b.hours::float8 AS hours, b.status, b.topic, b.meet_url,
           u.email AS user_email, u.name AS user_name
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.id = ${bookingId}
  `) as (Booking & {
    user_id: number;
    meet_url: string | null;
    user_email: string | null;
    user_name: string | null;
  })[];
  const booking = rows[0];
  if (!booking) return { ok: false, code: "not_found", message: "Termin nije pronađen." };

  await sql`UPDATE bookings SET meet_url = ${meetUrl} WHERE id = ${bookingId}`;

  // Mail only when a link actually appears, and only when it changed — saving
  // the same row twice must not send the client the same notice twice.
  const changed = meetUrl !== null && meetUrl !== booking.meet_url;
  if (changed && options.notify !== false) {
    await notifyMeetLink(bookingId, meetUrl, options.baseUrl);
  }

  return { ok: true, booking: { ...booking, meet_url: meetUrl } as Booking };
}

/**
 * Tell the client their meeting link is ready.
 *
 * Split out from `setBookingMeetUrl` because the automatic path writes the row
 * itself (from `createMeetForBooking`) and would otherwise see "nothing
 * changed" on the follow-up save and stay silent — the client would end up
 * with a link on the dashboard and no idea it was there.
 */
export async function notifyMeetLink(
  bookingId: number,
  meetUrl: string,
  baseUrl?: string,
): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    SELECT b.user_id, b.date::text AS date, b.start_slot, b.status,
           u.email AS user_email, u.name AS user_name
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.id = ${bookingId}
  `) as {
    user_id: number;
    date: string;
    start_slot: string;
    status: string;
    user_email: string | null;
    user_name: string | null;
  }[];
  const booking = rows[0];
  if (!booking?.user_email || booking.status !== "zakazano") return;

  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  await queueQuietly({
    userId: booking.user_id,
    recipient: booking.user_email,
    templateKey: "booking_link_ready",
    subject: `Link za termin ${formatDay(booking.date)} u ${booking.start_slot}`,
    body: [
      `Zdravo ${booking.user_name?.split(" ")[0] ?? ""},`,
      "",
      `Link za sastanak ${formatDay(booking.date)} u ${booking.start_slot}:`,
      meetUrl,
      "",
      `Stoji ti i na nalogu: ${base}/nalog/edukacija`,
      "",
      "TOZA AI",
    ].join("\n"),
  });
}

async function notifyBooked(
  userId: number,
  booking: Booking,
  baseUrl?: string,
  meetUrl?: string | null,
) {
  const sql = getSql();
  const users = (await sql`
    SELECT email, name FROM users WHERE id = ${userId}
  `) as { email: string; name: string | null }[];
  const user = users[0];
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const when = `${formatDay(booking.date)} u ${booking.start_slot}`;

  if (user) {
    await queueQuietly({
      userId,
      recipient: user.email,
      templateKey: "booking_confirmed",
      subject: `Termin zakazan — ${when}`,
      body: [
        `Zdravo ${user.name?.split(" ")[0] ?? ""},`,
        "",
        `Termin je rezervisan: ${when} · ${formatHours(booking.hours)}.`,
        booking.topic ? `Tema: ${booking.topic}` : null,
        `Sa stanja je skinuto ${formatHours(booking.hours)}.`,
        "",
        meetUrl ? "Link za sastanak:" : null,
        meetUrl ?? `Link za sastanak stiže ovde pre termina: ${base}/nalog/edukacija`,
        meetUrl ? `Termin i link su ti i na nalogu: ${base}/nalog/edukacija` : null,
        `Otkazivanje je moguće do ${CANCEL_CUTOFF_HOURS}h pre početka.`,
        "",
        "TOZA AI",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    });
  }

  await queueStudioNotice({
    templateKey: "studio_booking_created",
    subject: `Nov termin — ${booking.date} ${booking.start_slot}`,
    body: [
      `${user?.name ?? "Klijent"} (${user?.email ?? "—"}) je zakazao termin.`,
      `${when} · ${formatHours(booking.hours)} · ${HOUR_KIND_LABEL[booking.kind] ?? booking.kind}`,
      booking.topic ? `Tema: ${booking.topic}` : null,
      "",
      `${base}/admin/klijenti`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  });
}

import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { cancelBookingAsStudio, setBookingMeetUrl } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Booked sessions as the studio sees them.
//
// The panel had no view of this at all: a client could book an hour and the
// only trace was a row in the DB. Everything the studio has to do around a
// session — hand over the meeting link, mark it held, cancel it — happens here.
//
// Staff-only: /api/admin/* sits behind the admin session in middleware.ts.

type Filter = "upcoming" | "past" | "all";

/** A pasted meeting link. Only http(s) — a `javascript:` URL would be rendered
 *  as an anchor on the client's dashboard. */
function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("filter") ?? "upcoming";
  const filter: Filter = raw === "past" || raw === "all" ? raw : "upcoming";
  const sql = getSql();

  const rows =
    filter === "upcoming"
      ? await sql`
          SELECT b.id, b.kind, b.date::text AS date, b.start_slot, b.hours::float8 AS hours,
                 b.status, b.topic, b.meet_url, b.recording_url, b.created_at,
                 b.user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
          FROM bookings b
          LEFT JOIN users u ON u.id = b.user_id
          WHERE b.status = 'zakazano' AND b.date >= CURRENT_DATE
          ORDER BY b.date, b.start_slot
        `
      : filter === "past"
        ? await sql`
            SELECT b.id, b.kind, b.date::text AS date, b.start_slot, b.hours::float8 AS hours,
                   b.status, b.topic, b.meet_url, b.recording_url, b.created_at,
                   b.user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            WHERE b.status <> 'zakazano' OR b.date < CURRENT_DATE
            ORDER BY b.date DESC, b.start_slot DESC
            LIMIT 200
          `
        : await sql`
            SELECT b.id, b.kind, b.date::text AS date, b.start_slot, b.hours::float8 AS hours,
                   b.status, b.topic, b.meet_url, b.recording_url, b.created_at,
                   b.user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            ORDER BY b.date DESC, b.start_slot DESC
            LIMIT 200
          `;

  return NextResponse.json({ ok: true, filter, bookings: rows });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, message: "Neispravan termin." }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const sql = getSql();

  if (action === "set-meet") {
    // An empty field clears the link; anything else has to parse as a URL,
    // otherwise a typo would silently land on the client's dashboard.
    const raw = typeof body.meetUrl === "string" ? body.meetUrl.trim() : "";
    const url = raw === "" ? null : cleanUrl(raw);
    if (raw !== "" && url === null) {
      return NextResponse.json(
        { ok: false, message: "Link mora biti ispravan http(s) URL." },
        { status: 400 },
      );
    }
    const result = await setBookingMeetUrl(id, url, { baseUrl });
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 404 });
    }
    return NextResponse.json({ ok: true, meetUrl: url, notified: url !== null });
  }

  if (action === "set-recording") {
    const raw = typeof body.recordingUrl === "string" ? body.recordingUrl.trim() : "";
    const url = raw === "" ? null : cleanUrl(raw);
    if (raw !== "" && url === null) {
      return NextResponse.json(
        { ok: false, message: "Link mora biti ispravan http(s) URL." },
        { status: 400 },
      );
    }
    const updated = (await sql`
      UPDATE bookings SET recording_url = ${url} WHERE id = ${id} RETURNING id
    `) as { id: number }[];
    if (updated.length === 0) {
      return NextResponse.json({ ok: false, message: "Termin nije pronađen." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, recordingUrl: url });
  }

  if (action === "mark-held") {
    // The hours stay spent — the session happened. Only the status moves, so
    // the client's history reads "Održano" instead of a stale "Zakazano".
    const updated = (await sql`
      UPDATE bookings SET status = 'odrzano'
      WHERE id = ${id} AND status = 'zakazano'
      RETURNING id
    `) as { id: number }[];
    if (updated.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Termin nije pronađen ili je već zatvoren." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, status: "odrzano" });
  }

  if (action === "cancel") {
    const result = await cancelBookingAsStudio(id, {
      refund: body.refund !== false,
      reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 300) || null : null,
      baseUrl,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "otkazano" });
  }

  return NextResponse.json({ ok: false, message: "Nepoznata akcija." }, { status: 400 });
}

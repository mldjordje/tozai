import "server-only";
import { getSql } from "@/lib/db";

// Google Calendar, used for one thing: giving every booked session a real Meet
// room the moment it is booked.
//
// WHY A REFRESH TOKEN. The buyer can book at 23:00 with nobody from the studio
// logged in, so the server has to be able to act as the studio account on its
// own. The login flow's access token dies in an hour and belongs to whoever
// signed in — useless here. The studio connects once (admin → Termini →
// "Poveži Google kalendar"), Google hands back a refresh token, and that token
// is exchanged for a fresh access token whenever an event has to be written.
//
// The token is stored on `studio_settings` and never leaves the server: it is
// not in any API response, not in a client component, not in a cookie.

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const STUDIO_TIMEZONE = "Europe/Belgrade";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";

export type CalendarStatus = {
  connected: boolean;
  email: string | null;
  calendarId: string;
  connectedAt: string | null;
  /** False when GOOGLE_CLIENT_ID/SECRET are missing — connecting cannot work. */
  configured: boolean;
};

type CredentialRow = {
  gcal_refresh_token: string | null;
  gcal_email: string | null;
  gcal_calendar_id: string | null;
  gcal_connected_at: string | null;
};

function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function readCredentials(): Promise<CredentialRow | null> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT gcal_refresh_token, gcal_email, gcal_calendar_id,
             gcal_connected_at::text AS gcal_connected_at
      FROM studio_settings WHERE id = 1
    `) as CredentialRow[];
    return rows[0] ?? null;
  } catch {
    // Column missing (pre-migration) or DB down — read as "not connected"
    // rather than taking a booking down with it.
    return null;
  }
}

export async function getCalendarStatus(): Promise<CalendarStatus> {
  const row = await readCredentials();
  return {
    connected: Boolean(row?.gcal_refresh_token),
    email: row?.gcal_email ?? null,
    calendarId: row?.gcal_calendar_id ?? "primary",
    connectedAt: row?.gcal_connected_at ?? null,
    configured: oauthConfigured(),
  };
}

export async function saveCalendarCredentials(input: {
  refreshToken: string;
  email: string | null;
}) {
  const sql = getSql();
  await sql`
    UPDATE studio_settings
    SET gcal_refresh_token = ${input.refreshToken},
        gcal_email = ${input.email},
        gcal_connected_at = now()
    WHERE id = 1
  `;
  cachedToken = null;
}

export async function disconnectCalendar() {
  const sql = getSql();
  await sql`
    UPDATE studio_settings
    SET gcal_refresh_token = NULL, gcal_email = NULL, gcal_connected_at = NULL
    WHERE id = 1
  `;
  cachedToken = null;
}

// Access tokens last an hour; refreshing on every booking would be a needless
// round trip to Google. Cached in module scope with a safety margin — a cold
// serverless instance simply refreshes again.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  if (!oauthConfigured()) return null;
  const row = await readCredentials();
  const refreshToken = row?.gcal_refresh_token;
  if (!refreshToken) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    // A revoked or expired grant is permanent until the studio reconnects.
    // Clearing it is what makes the panel show "nije povezan" instead of
    // failing silently on every booking from here on.
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    console.error("[gcal] refresh failed", response.status, body.error);
    if (body.error === "invalid_grant") await disconnectCalendar();
    return null;
  }
  const tokens = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!tokens.access_token) return null;
  cachedToken = {
    value: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
  return tokens.access_token;
}

export type MeetEvent = { eventId: string; meetUrl: string | null; htmlLink: string | null };

export type MeetRequest = {
  bookingId: number;
  date: string;
  startSlot: string;
  hours: number;
  summary: string;
  description?: string | null;
  attendeeEmail?: string | null;
};

/**
 * Create the calendar event and its Meet room.
 *
 * Returns null instead of throwing on every failure path. A booking is already
 * committed by the time this runs — Google being unreachable must cost the
 * buyer a link, not the session they just paid an hour for. The studio sees
 * "Bez linka" in the panel and can paste one by hand.
 */
export async function createMeetEvent(request: MeetRequest): Promise<MeetEvent | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const status = await getCalendarStatus();

  const start = `${request.date}T${request.startSlot}:00`;
  const [h, m] = request.startSlot.split(":").map(Number);
  const endHour = h + Math.round(request.hours);
  const end = `${request.date}T${String(endHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

  const body = {
    summary: request.summary,
    description: request.description ?? undefined,
    start: { dateTime: start, timeZone: STUDIO_TIMEZONE },
    end: { dateTime: end, timeZone: STUDIO_TIMEZONE },
    attendees: request.attendeeEmail ? [{ email: request.attendeeEmail }] : undefined,
    conferenceData: {
      createRequest: {
        // Idempotency key: Google reuses the same conference for a repeated
        // requestId, so a retry cannot open a second room for one session.
        requestId: `tozai-booking-${request.bookingId}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  try {
    const response = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(status.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      console.error("[gcal] event create failed", response.status, await response.text());
      return null;
    }
    const event = (await response.json()) as {
      id: string;
      hangoutLink?: string;
      htmlLink?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    };
    const entry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
    return {
      eventId: event.id,
      meetUrl: event.hangoutLink ?? entry?.uri ?? null,
      htmlLink: event.htmlLink ?? null,
    };
  } catch (error) {
    console.error("[gcal] event create threw", error);
    return null;
  }
}

/** Best-effort cleanup when a session is cancelled. A stale event on the
 *  studio's calendar is untidy; a failed cancellation would be worse. */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  const status = await getCalendarStatus();
  try {
    const response = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(status.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    // 410 means it is already gone, which is the outcome we wanted.
    return response.ok || response.status === 410;
  } catch (error) {
    console.error("[gcal] event delete threw", error);
    return false;
  }
}

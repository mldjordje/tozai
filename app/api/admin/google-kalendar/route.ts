import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { setOAuthTxnCookie, signOAuthTxnToken } from "@/lib/auth/user-session";
import {
  CALENDAR_SCOPE,
  disconnectCalendar,
  getCalendarStatus,
} from "@/lib/google/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Connect / disconnect the studio's Google Calendar.
//
// Behind the admin session (middleware.ts), which is the gate that matters:
// the consent screen this starts asks for permission to write to a calendar,
// so it must not be reachable by anyone who wanders past the URL.
//
// The redirect URI is the login callback, already registered in the Google
// console. The txn cookie carries `mode: "calendar"` so the callback knows to
// store a refresh token instead of signing somebody in.

export async function GET() {
  return NextResponse.json({ ok: true, status: await getCalendarStatus() });
}

export async function POST(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { ok: false, message: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nisu podešeni." },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${request.nextUrl.origin}/api/auth/google/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", `openid email ${CALENDAR_SCOPE}`);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  // offline + consent is the whole point: without both, Google returns an
  // access token that dies in an hour and no refresh token to renew it, and
  // the server could never create an event on its own again.
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const response = NextResponse.json({ ok: true, url: authUrl.toString() });
  setOAuthTxnCookie(
    response,
    await signOAuthTxnToken({ state, verifier, next: "/admin/termini", mode: "calendar" }),
  );
  return response;
}

export async function DELETE() {
  await disconnectCalendar();
  return NextResponse.json({ ok: true });
}

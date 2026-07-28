import { NextResponse } from "next/server";
import { sendUpcomingSessionReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The only scheduled job in the app. Ping it every few minutes — Vercel Cron
// does it from vercel.json, any external pinger works the same way — and it
// mails the studio about sessions starting within the hour.
//
// The endpoint sits outside the middleware matcher on purpose: a cron caller
// has no session cookie. `CRON_SECRET` is what stands in for one, sent either
// as `Authorization: Bearer` (Vercel's own format) or `?key=` (for pingers that
// cannot set headers). Without the variable the route refuses to run rather
// than defaulting to open — an unauthenticated endpoint that sends mail is a
// way to flood the studio's inbox from the outside.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("key") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendUpcomingSessionReminders(new URL(request.url).origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // A failed run must be visible in the function log, but a 500 makes Vercel
    // retry a job whose whole point is to run again in a few minutes anyway.
    console.error("[cron] podsetnici failed", error);
    return NextResponse.json({ ok: false, message: "Reminder run failed" }, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/user-session";
import { getAvailableMonth } from "@/lib/bookings";
import { MAX_BOOKING_HOURS } from "@/lib/booking-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Free slots for the buyer's calendar. Same source as the admin availability
// view, minus everything already booked and everything already past — the
// buyer must never be shown a slot the POST would refuse.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, message: "month=YYYY-MM required" }, { status: 400 });
  }
  const days = await getAvailableMonth(month);
  return NextResponse.json({ ok: true, month, days, maxHours: MAX_BOOKING_HOURS });
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/user-session";
import { createBooking, type BookingFailure } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The buyer books a session against their own wallet. The user id comes from
// the session cookie only — nothing in the body identifies who is booking.

const STATUS: Record<BookingFailure, number> = {
  invalid: 400,
  past: 409,
  closed: 409,
  taken: 409,
  balance: 402,
  not_found: 404,
  too_late: 409,
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const result = await createBooking(
    user.uid,
    {
      date: typeof body.date === "string" ? body.date : "",
      startSlot: typeof body.startSlot === "string" ? body.startSlot : "",
      hours: Number(body.hours ?? 1),
      kind: body.kind === "consulting" ? "consulting" : "education",
      topic: typeof body.topic === "string" ? body.topic : null,
    },
    { baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin },
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: STATUS[result.code] },
    );
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}

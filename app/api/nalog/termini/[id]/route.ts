import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/user-session";
import { cancelBooking } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cancel own booking: frees the slot and refunds the hours to the wallet.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, message: "Neispravan termin." }, { status: 400 });
  }

  const result = await cancelBooking(user.uid, id);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 409;
    return NextResponse.json({ ok: false, code: result.code, message: result.message }, { status });
  }
  return NextResponse.json({ ok: true, booking: result.booking });
}

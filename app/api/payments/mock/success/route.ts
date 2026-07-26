import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/user-token";
import { fulfillPaidOrder } from "@/lib/payments/fulfill";
import { isMockPaymentEnabled } from "@/lib/payments/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Return URL of the test provider. Mirrors the Monri return handler: verify
// that the callback is genuine, fulfil once, then land the buyer where the
// thing they bought now lives.
//
// `?ishod=neuspeh` simulates a declined card, so the failure path can be tested
// without a real gateway.

export async function GET(request: NextRequest) {
  if (!isMockPaymentEnabled()) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const failed = request.nextUrl.searchParams.get("ishod") === "neuspeh";
  const payload = await verifyToken(request.nextUrl.searchParams.get("token") ?? undefined);
  if (!payload || payload.kind !== "mock-payment" || typeof payload.orderId !== "number") {
    return NextResponse.redirect(new URL("/nalog/porudzbine?placanje=neuspesno", request.url));
  }
  if (failed) {
    return NextResponse.redirect(new URL("/nalog/porudzbine?placanje=neuspesno", request.url));
  }

  const result = await fulfillPaidOrder(payload.orderId, {
    provider: "mock",
    providerRef: `TEST-${payload.orderId}`,
  });

  const destination = result.projectId
    ? `/nalog/projekti/${result.projectId}?placanje=uspesno`
    : result.hoursCredited > 0
      ? "/nalog/edukacija?placanje=uspesno"
      : "/nalog/porudzbine?placanje=uspesno";
  return NextResponse.redirect(new URL(destination, request.url));
}

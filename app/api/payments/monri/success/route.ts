import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { fulfillPaidOrder } from "@/lib/payments/fulfill";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const key = process.env.MONRI_MERCHANT_KEY;
  const orderNumber = request.nextUrl.searchParams.get("order_number") ?? "";
  const digest = request.nextUrl.searchParams.get("digest") ?? "";
  const responseCode = request.nextUrl.searchParams.get("response_code") ?? "";
  const match = /^TZ-(\d+)$/.exec(orderNumber);

  if (!key || !match || !digest) {
    return NextResponse.redirect(new URL("/nalog/porudzbine?placanje=neuspesno", request.url));
  }
  const expected = createHash("sha1").update(`${key}${orderNumber}`).digest("hex");
  if (!safeEqual(expected, digest) || !responseCode.startsWith("000")) {
    return NextResponse.redirect(new URL("/nalog/porudzbine?placanje=neuspesno", request.url));
  }

  const orderId = Number(match[1]);
  await fulfillPaidOrder(orderId, {
    provider: "monri",
    providerRef: request.nextUrl.searchParams.get("approval_code") ?? undefined,
  });
  return NextResponse.redirect(new URL("/nalog/projekti?placanje=uspesno", request.url));
}

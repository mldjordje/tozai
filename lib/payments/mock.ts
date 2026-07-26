import "server-only";
import { signToken } from "@/lib/auth/user-token";
import type { PaymentProvider } from "./provider";

// Test provider: stands in for Monri until the real credentials arrive.
//
// It behaves exactly like a hosted-page provider — the buyer is redirected out
// of the checkout and comes back through a return URL that fulfils the order —
// so everything downstream (invoice, project, wallet hours, /nalog) is
// exercised on the same code path the real card flow will use. Nothing here is
// a shortcut around fulfilment; only the "did the money arrive" step is faked.
//
// Only active when PAYMENTS_MOCK=1. The return URL carries a signed, short-
// lived token so the endpoint cannot be used to mark an arbitrary order paid
// even while the flag is on.

export const MOCK_PAYMENT_TTL_SECONDS = 30 * 60;

export function isMockPaymentEnabled(): boolean {
  return process.env.PAYMENTS_MOCK === "1";
}

export async function signMockPaymentToken(orderId: number): Promise<string> {
  return signToken({ kind: "mock-payment", orderId }, MOCK_PAYMENT_TTL_SECONDS);
}

export const mockProvider: PaymentProvider = {
  id: "mock",

  async createCheckout(order) {
    const token = await signMockPaymentToken(order.id);
    return {
      kind: "redirect",
      provider: "mock",
      redirectUrl: `/api/payments/mock/success?token=${encodeURIComponent(token)}`,
    };
  },
};

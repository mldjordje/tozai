import "server-only";
import type { PaymentProvider } from "./provider";

/**
 * Monri card payment — NOT IMPLEMENTED.
 *
 * The integration is blocked on credentials from Monri. This module exists so
 * the shape of the work is visible and the switch-over is a single file, but it
 * deliberately throws rather than pretending to work: getPaymentProvider() only
 * selects it when MONRI_MERCHANT_KEY and MONRI_AUTH_TOKEN are both set, so
 * reaching this code means someone configured the env vars before the code
 * landed, and a loud failure beats a buyer stranded on a broken payment page.
 *
 * To finish it:
 *   1. POST the order to Monri's payment-form endpoint, signing the digest with
 *      the merchant key (order number, amount in minor units, currency).
 *   2. Return { kind: "redirect", provider: "monri", redirectUrl }.
 *   3. Add app/api/payments/monri/webhook/route.ts — verify the signature, then
 *      call fulfillPaidOrder(orderId). It is idempotent, so replays are safe.
 *   4. Record orders.provider = 'monri' and orders.provider_ref = the Monri id.
 *
 * Amounts are stored in EUR as NUMERIC; Monri expects minor units, so convert
 * with Math.round(amount * 100) and never with floating-point truncation.
 */
export const monriProvider: PaymentProvider = {
  id: "monri",

  async createCheckout() {
    throw new Error(
      "[payments] Monri credentials are set but the integration is not implemented yet. " +
        "Unset MONRI_MERCHANT_KEY / MONRI_AUTH_TOKEN to fall back to bank transfer.",
    );
  },
};

import "server-only";
import { getSql } from "@/lib/db";
import type { OrderForPayment, PaymentIntent, PaymentProvider } from "./provider";

// V1 provider: proforma + bank transfer.
//
// This is not a stub standing in for the real thing — it is a payment method
// the studio can actually collect on today, and it stays useful for company
// buyers who need a proforma regardless of whether card payment exists.
//
// The order stays `pending` until someone confirms the money arrived, which
// calls fulfillPaidOrder(). No webhook can be forged into a free purchase
// because nothing here marks an order paid.

/** Reference the buyer must quote on the transfer, and the studio matches
 *  against when reconciling. Derived from the order id so it is unique and
 *  needs no extra column. */
export function paymentReference(orderId: number): string {
  return `TZ-${String(orderId).padStart(5, "0")}`;
}

export const manualProvider: PaymentProvider = {
  id: "manual",

  async createCheckout(order: OrderForPayment): Promise<PaymentIntent> {
    let payee = { name: null as string | null, account: null as string | null, pib: null as string | null, mb: null as string | null };
    try {
      const sql = getSql();
      const rows = (await sql`
        SELECT company_name, name, bank_account, pib, mb
        FROM studio_settings WHERE id = 1
      `) as {
        company_name: string | null;
        name: string | null;
        bank_account: string | null;
        pib: string | null;
        mb: string | null;
      }[];
      const s = rows[0];
      if (s) {
        payee = {
          name: s.company_name ?? s.name,
          account: s.bank_account,
          pib: s.pib,
          mb: s.mb,
        };
      }
    } catch {
      // Settings unreachable: still return an intent. The buyer gets their
      // reference and the studio can chase the details — better than failing
      // an order that is otherwise valid.
    }

    return {
      kind: "manual",
      provider: "manual",
      reference: paymentReference(order.id),
      amount: order.amount,
      currency: order.currency,
      payee,
    };
  },
};

import "server-only";

// The seam Monri will drop into.
//
// Nothing in the checkout knows which provider is active. A provider turns a
// pending order into a PaymentIntent: either a URL to hand the buyer off to, or
// instructions to settle it out of band. When Monri credentials arrive, adding
// the module and the env vars switches the whole flow over — no checkout or
// fulfilment code changes.

export type OrderForPayment = {
  id: number;
  item: string;
  amount: number;
  currency: string;
  buyerEmail: string;
  buyer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  };
};

export type PaymentIntent =
  /** Hand the buyer to a hosted payment page. */
  | { kind: "redirect"; provider: string; redirectUrl: string }
  | {
      kind: "form";
      provider: "monri";
      action: string;
      fields: Record<string, string>;
    }
  /** Settle out of band — bank transfer against a proforma. */
  | {
      kind: "manual";
      provider: string;
      reference: string;
      amount: number;
      currency: string;
      /** Payee details, rendered as the payment slip. Values may be null when
       *  the studio settings have not been filled in yet. */
      payee: {
        name: string | null;
        account: string | null;
        pib: string | null;
        mb: string | null;
      };
    };

export interface PaymentProvider {
  id: string;
  createCheckout(order: OrderForPayment): Promise<PaymentIntent>;
}

/**
 * Pick the active provider. Card payment is only offered once it is actually
 * configured — defaulting to a half-wired card flow would let a buyer reach a
 * dead payment page, which is worse than an honest bank transfer.
 */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (process.env.MONRI_MERCHANT_KEY && process.env.MONRI_AUTH_TOKEN) {
    const { monriProvider } = await import("./monri");
    return monriProvider;
  }
  const { manualProvider } = await import("./manual");
  return manualProvider;
}

/** Whether card payment is live. The checkout uses this to set expectations
 *  before the buyer commits, rather than surprising them at the last step. */
export function isCardPaymentConfigured(): boolean {
  return Boolean(process.env.MONRI_MERCHANT_KEY && process.env.MONRI_AUTH_TOKEN);
}

import "server-only";
import {
  cardConfigured,
  mockEnabled,
  type PaymentMethod,
} from "./selection";
export {
  defaultPaymentMethod,
  normalizePaymentMethod,
  paymentAvailability,
  type PaymentAvailability,
  type PaymentMethod,
} from "./selection";

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

/** What the buyer picks at checkout. `invoice` is a proforma settled by bank
 *  transfer — from a banking app, or over the counter. */

/**
 * Resolve the provider for the method the buyer chose.
 *
 * Throws rather than silently falling back: quietly turning a card payment into
 * a bank transfer would leave the buyer waiting for a redirect that never comes
 * and the studio expecting money that was never sent.
 */
export async function getProviderFor(method: PaymentMethod): Promise<PaymentProvider> {
  if (method === "invoice") {
    const { manualProvider } = await import("./manual");
    return manualProvider;
  }

  if (cardConfigured()) {
    const { monriProvider } = await import("./monri");
    return monriProvider;
  }
  if (mockEnabled()) {
    // Stands in for the hosted card page so the whole post-payment half of the
    // product can be walked end to end while Monri credentials are pending.
    const { mockProvider } = await import("./mock");
    return mockProvider;
  }
  throw new Error("[payments] card payment is not configured");
}

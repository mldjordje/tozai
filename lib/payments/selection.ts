export type PaymentMethod = "card" | "invoice";

export type PaymentAvailability = {
  card: boolean;
  invoice: boolean;
  cardIsTest: boolean;
};

export function cardConfigured(): boolean {
  return Boolean(process.env.MONRI_MERCHANT_KEY && process.env.MONRI_AUTH_TOKEN);
}

export function mockEnabled(): boolean {
  return process.env.PAYMENTS_MOCK === "1";
}

/** The mock provider settles an order without any money moving. It is a
 *  development tool, so it is refused outright in a production build — a
 *  PAYMENTS_MOCK left set on the deployment would otherwise hand out free
 *  purchases to real buyers. */
function testCardEnabled(): boolean {
  return mockEnabled() && process.env.NODE_ENV !== "production";
}

export function paymentAvailability(): PaymentAvailability {
  return {
    // Card is offered only against real credentials. Until Monri sends them,
    // the option is visible but disabled and reads "uskoro" — hiding it would
    // suggest bank transfer is the only way this studio will ever take money.
    card: cardConfigured() || testCardEnabled(),
    invoice: true,
    cardIsTest: !cardConfigured() && testCardEnabled(),
  };
}

export function defaultPaymentMethod(): PaymentMethod {
  return paymentAvailability().card ? "card" : "invoice";
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (value !== "card" && value !== "invoice") return null;
  return paymentAvailability()[value] ? value : null;
}

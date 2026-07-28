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

export function paymentAvailability(): PaymentAvailability {
  return {
    card: cardConfigured() || mockEnabled(),
    invoice: true,
    cardIsTest: !cardConfigured() && mockEnabled(),
  };
}

export function defaultPaymentMethod(): PaymentMethod {
  return paymentAvailability().card ? "card" : "invoice";
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (value !== "card" && value !== "invoice") return null;
  return paymentAvailability()[value] ? value : null;
}

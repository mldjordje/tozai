import "server-only";
import { createHash } from "node:crypto";
import type { PaymentProvider } from "./provider";

/**
 * Hosted Monri WebPay form. The browser posts signed order fields directly to
 * Monri, so card data never passes through the TOZA AI server.
 */
export const monriProvider: PaymentProvider = {
  id: "monri",

  async createCheckout(order) {
    const key = process.env.MONRI_MERCHANT_KEY;
    const authenticityToken = process.env.MONRI_AUTH_TOKEN;
    if (!key || !authenticityToken) {
      throw new Error("[payments] Monri credentials are missing.");
    }

    const amount = String(Math.round(order.amount * 100));
    const currency = order.currency.toUpperCase();
    const orderNumber = `TZ-${String(order.id).padStart(5, "0")}`;
    const digest = createHash("sha512")
      .update(`${key}${orderNumber}${amount}${currency}`)
      .digest("hex");
    const test = process.env.MONRI_ENV !== "production";
    const fields: Record<string, string> = {
      amount,
      currency,
      order_number: orderNumber,
      order_info: order.item.slice(0, 100),
      transaction_type: "purchase",
      authenticity_token: authenticityToken,
      digest,
      language: "hr",
      ch_email: order.buyerEmail.slice(0, 100),
      ch_country: "RS",
    };
    if (order.buyer?.name) fields.ch_full_name = order.buyer.name.slice(0, 30);
    if (order.buyer?.phone) fields.ch_phone = order.buyer.phone.slice(0, 30);
    if (order.buyer?.address) fields.ch_address = order.buyer.address.slice(0, 100);
    if (order.buyer?.city) fields.ch_city = order.buyer.city.slice(0, 30);

    return {
      kind: "form",
      provider: "monri",
      action: test ? "https://ipgtest.monri.com/v2/form" : "https://ipg.monri.com/v2/form",
      fields,
    };
  },
};

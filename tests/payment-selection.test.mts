import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPaymentMethod,
  normalizePaymentMethod,
  paymentAvailability,
} from "../lib/payments/selection.ts";

function withEnv(
  values: Partial<Record<"MONRI_MERCHANT_KEY" | "MONRI_AUTH_TOKEN" | "PAYMENTS_MOCK", string>>,
  run: () => void,
) {
  const keys = ["MONRI_MERCHANT_KEY", "MONRI_AUTH_TOKEN", "PAYMENTS_MOCK"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("invoice remains selectable when card payments are not configured", () => {
  withEnv({}, () => {
    assert.deepEqual(paymentAvailability(), {
      card: false,
      invoice: true,
      cardIsTest: false,
    });
    assert.equal(defaultPaymentMethod(), "invoice");
    assert.equal(normalizePaymentMethod("card"), null);
    assert.equal(normalizePaymentMethod("invoice"), "invoice");
  });
});

test("configured card payment becomes the default choice", () => {
  withEnv({ MONRI_MERCHANT_KEY: "merchant", MONRI_AUTH_TOKEN: "secret" }, () => {
    assert.equal(paymentAvailability().card, true);
    assert.equal(defaultPaymentMethod(), "card");
    assert.equal(normalizePaymentMethod("card"), "card");
  });
});

test("mock card mode is explicit and visible as test mode", () => {
  withEnv({ PAYMENTS_MOCK: "1" }, () => {
    assert.equal(paymentAvailability().card, true);
    assert.equal(paymentAvailability().cardIsTest, true);
    assert.equal(defaultPaymentMethod(), "card");
  });
});

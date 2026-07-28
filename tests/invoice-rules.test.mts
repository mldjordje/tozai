import assert from "node:assert/strict";
import test from "node:test";
import { invoiceNumber, invoiceScope } from "../lib/invoices/rules.ts";

test("invoice and proforma use separate yearly series", () => {
  assert.equal(invoiceNumber("proforma", 2026, 1), "PR-2026-0001");
  assert.equal(invoiceNumber("invoice", 2026, 27), "TZ-2026-0027");
});

test("Serbia aliases produce domestic invoices", () => {
  for (const country of [null, "", "RS", "SRB", "Srbija", "Serbia"]) {
    assert.equal(invoiceScope(country), "domestic");
  }
});

test("other countries produce English foreign invoices", () => {
  assert.equal(invoiceScope("DE"), "foreign");
  assert.equal(invoiceScope("Bosna i Hercegovina"), "foreign");
});

import assert from "node:assert/strict";
import test from "node:test";
import { ledgerReason } from "../lib/hours-ledger.ts";

test("hours added by hand are always 'manual'", () => {
  assert.equal(ledgerReason(5), "manual");
  // A reason sent alongside a positive amount is ignored — there is only one
  // way hours arrive by hand.
  assert.equal(ledgerReason(5, "offline"), "manual");
  assert.equal(ledgerReason(0.5, "correction"), "manual");
});

test("a lesson held off-app is recorded as consumption, not as a mistake", () => {
  assert.equal(ledgerReason(-2, "offline"), "offline");
});

test("undoing a mis-keyed grant stays a correction", () => {
  assert.equal(ledgerReason(-2, "correction"), "correction");
});

test("an unknown or missing reason falls back to correction", () => {
  assert.equal(ledgerReason(-2), "correction");
  assert.equal(ledgerReason(-2, undefined), "correction");
  assert.equal(ledgerReason(-2, ""), "correction");
  assert.equal(ledgerReason(-2, "purchase"), "correction");
  assert.equal(ledgerReason(-2, "booking"), "correction");
  // Nothing a client can send should end up in the column verbatim.
  assert.equal(ledgerReason(-2, { toString: () => "offline" }), "correction");
  assert.equal(ledgerReason(-2, 42), "correction");
  assert.equal(ledgerReason(-2, null), "correction");
});

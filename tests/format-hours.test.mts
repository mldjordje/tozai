import assert from "node:assert/strict";
import test from "node:test";
import { formatHours } from "../lib/format.ts";

test("formatHours picks the right Serbian form", () => {
  assert.equal(formatHours(1), "1 sat");
  assert.equal(formatHours(2), "2 sata");
  assert.equal(formatHours(4), "4 sata");
  assert.equal(formatHours(5), "5 sati");
  assert.equal(formatHours(11), "11 sati");
  assert.equal(formatHours(12), "12 sati");
  assert.equal(formatHours(21), "21 sat");
  assert.equal(formatHours(22), "22 sata");
  assert.equal(formatHours(25), "25 sati");
  assert.equal(formatHours(0), "0 sati");
});

test("formatHours keeps fractions plural", () => {
  assert.equal(formatHours(1.5), "1,5 sati");
  assert.equal(formatHours(2.25), "2,25 sati");
});

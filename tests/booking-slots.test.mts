import assert from "node:assert/strict";
import test from "node:test";
import {
  minutesUntil,
  slotSequence,
  slotToMinutes,
  startsFor,
} from "../lib/booking-slots.ts";

test("slotToMinutes accepts the grid and rejects junk", () => {
  assert.equal(slotToMinutes("09:00"), 540);
  assert.equal(slotToMinutes("23:30"), 1410);
  assert.equal(slotToMinutes("24:00"), null);
  assert.equal(slotToMinutes("9:00"), null);
  assert.equal(slotToMinutes(""), null);
});

test("slotSequence spans consecutive hours", () => {
  assert.deepEqual(slotSequence("09:00", 1), ["09:00"]);
  assert.deepEqual(slotSequence("09:00", 3), ["09:00", "10:00", "11:00"]);
});

test("slotSequence refuses fractional, oversized and overnight ranges", () => {
  assert.equal(slotSequence("09:00", 1.5), null);
  assert.equal(slotSequence("09:00", 0), null);
  assert.equal(slotSequence("09:00", 5), null);
  assert.equal(slotSequence("22:00", 3), null); // would land at 00:00
});

test("startsFor only offers blocks that are free end to end", () => {
  const free = ["09:00", "10:00", "12:00", "13:00", "14:00"];
  assert.deepEqual(startsFor(free, 1), free);
  assert.deepEqual(startsFor(free, 2), ["09:00", "12:00", "13:00"]);
  assert.deepEqual(startsFor(free, 3), ["12:00"]);
  assert.deepEqual(startsFor(free, 4), []);
});

test("startsFor treats a booked hour in the middle as a wall", () => {
  // 11:00 is taken, so a 2h session cannot start at 10:00.
  assert.deepEqual(startsFor(["10:00", "12:00"], 2), []);
});

test("minutesUntil compares calendar days, not parsed instants", () => {
  const now = { date: "2026-07-28", minutes: 10 * 60 };
  assert.equal(minutesUntil("2026-07-28", "12:00", now), 120);
  assert.equal(minutesUntil("2026-07-28", "09:00", now), -60);
  assert.equal(minutesUntil("2026-07-29", "09:00", now), 1380);
  assert.equal(minutesUntil("2026-08-01", "10:00", now), 4 * 1440);
  assert.equal(minutesUntil("bad", "10:00", now), null);
});

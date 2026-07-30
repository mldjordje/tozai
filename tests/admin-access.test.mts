import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_OWNER_EMAILS,
  isAdminOwner,
  normalizeEmail,
  wantsAdminDestination,
} from "../lib/auth/admin-access.ts";

test("both owner addresses open the panel", () => {
  assert.deepEqual(
    [...ADMIN_OWNER_EMAILS],
    ["tozaayt@gmail.com", "svetozartoza.markovic02@gmail.com"],
  );
  for (const owner of ADMIN_OWNER_EMAILS) {
    assert.equal(isAdminOwner(owner), true);
  }
});

test("owner matching is case-insensitive and ignores stray whitespace", () => {
  for (const owner of ADMIN_OWNER_EMAILS) {
    assert.equal(isAdminOwner(owner.toUpperCase()), true);
    assert.equal(isAdminOwner(`  ${owner}  `), true);
  }
});

test("no other address opens the panel", () => {
  assert.equal(isAdminOwner("buyer@example.com"), false);
  // A lookalike domain, and a local part that merely contains an owner's.
  assert.equal(isAdminOwner("tozaayt@gmail.com.evil.com"), false);
  assert.equal(isAdminOwner("xtozaayt@gmail.com"), false);
  assert.equal(isAdminOwner("svetozartoza.markovic02@gmail.com.evil.com"), false);
});

test("a missing address is not the owner", () => {
  assert.equal(isAdminOwner(null), false);
  assert.equal(isAdminOwner(undefined), false);
  assert.equal(isAdminOwner(""), false);
  assert.equal(normalizeEmail(null), "");
});

test("admin intent is recognized only for admin paths", () => {
  assert.equal(wantsAdminDestination("/admin"), true);
  assert.equal(wantsAdminDestination("/admin/porudzbine"), true);
  assert.equal(wantsAdminDestination("/nalog"), false);
  assert.equal(wantsAdminDestination("/administrator"), false);
});

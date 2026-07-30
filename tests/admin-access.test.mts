import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_OWNER_EMAIL,
  isAdminOwner,
  normalizeEmail,
  wantsAdminDestination,
} from "../lib/auth/admin-access.ts";

test("the owner address is matched case-insensitively and ignores stray whitespace", () => {
  assert.equal(isAdminOwner(ADMIN_OWNER_EMAIL), true);
  assert.equal(isAdminOwner(ADMIN_OWNER_EMAIL.toUpperCase()), true);
  assert.equal(isAdminOwner(`  ${ADMIN_OWNER_EMAIL}  `), true);
});

test("no other address opens the panel", () => {
  assert.equal(isAdminOwner("buyer@example.com"), false);
  // The second owner row that used to sit in `staff` alongside the real one.
  assert.equal(isAdminOwner("svetozartoza.markovic02@gmail.com"), false);
  // A lookalike domain, and a local part that merely contains the owner's.
  assert.equal(isAdminOwner("tozaayt@gmail.com.evil.com"), false);
  assert.equal(isAdminOwner("xtozaayt@gmail.com"), false);
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

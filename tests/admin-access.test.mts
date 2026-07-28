import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapAdminEmails,
  isBootstrapAdmin,
  wantsAdminDestination,
} from "../lib/auth/admin-access.ts";

test("bootstrap admin emails are normalized and empty entries are ignored", () => {
  assert.deepEqual(
    bootstrapAdminEmails(" Owner@Example.com, ,staff@example.com "),
    ["owner@example.com", "staff@example.com"],
  );
});

test("bootstrap admin matching is case insensitive", () => {
  assert.equal(
    isBootstrapAdmin("OWNER@example.com", "owner@example.com,staff@example.com"),
    true,
  );
  assert.equal(isBootstrapAdmin("buyer@example.com", "owner@example.com"), false);
});

test("admin intent is recognized only for admin paths", () => {
  assert.equal(wantsAdminDestination("/admin"), true);
  assert.equal(wantsAdminDestination("/admin/porudzbine"), true);
  assert.equal(wantsAdminDestination("/nalog"), false);
  assert.equal(wantsAdminDestination("/administrator"), false);
});

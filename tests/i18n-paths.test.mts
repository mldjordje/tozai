import assert from "node:assert/strict";
import test from "node:test";
import type { NextConfig } from "next";
import { localePath } from "../lib/i18n/config.ts";
import nextConfigModule from "../next.config.ts";

// Under `tsx --test` a .ts import arrives as the CommonJS namespace, so the
// config sits on `.default` and reading `.redirects` straight off it gives
// undefined — which is what this file was asserting against, not a missing
// redirect. Unwrapped here so the test checks the config either way.
const nextConfig: NextConfig =
  (nextConfigModule as { default?: NextConfig }).default ?? nextConfigModule;

test("home page aliases never produce an /en/index URL", () => {
  for (const alias of ["/index", "/index.html"]) {
    assert.equal(localePath("sr", alias), "/");
    assert.equal(localePath("en", alias), "/en");
  }
});

test("legacy English home aliases redirect to /en", async () => {
  assert.equal(typeof nextConfig.redirects, "function");
  const redirects = await nextConfig.redirects!();
  assert.ok(
    redirects.some(
      (redirect) =>
        redirect.source === "/en/index" &&
        redirect.destination === "/en" &&
        redirect.permanent === true,
    ),
  );
});

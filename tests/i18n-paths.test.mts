import assert from "node:assert/strict";
import test from "node:test";
import { localePath } from "../lib/i18n/config.ts";
import nextConfig from "../next.config.ts";

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

import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";

process.env.AUTH_JWT_SECRET = "test-secret-for-session-epoch";
const { verifySessionToken } = await import("../lib/auth/session.ts");

const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET);

/** Signs an admin token claiming to have been issued at `iat`. */
async function tokenIssuedAt(iat: number) {
  return new SignJWT({ role: "owner", userId: 1, name: "Owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60 * 60 * 24 * 30)
    .sign(secret);
}

const EPOCH = 1785446462;

test("a session minted before the cutoff is refused", async () => {
  // What the deleted password login would have handed out.
  assert.equal(await verifySessionToken(await tokenIssuedAt(EPOCH - 1)), null);
  assert.equal(await verifySessionToken(await tokenIssuedAt(EPOCH - 86_400)), null);
});

test("a session minted after the cutoff is accepted", async () => {
  const payload = await verifySessionToken(await tokenIssuedAt(EPOCH + 10));
  assert.equal(payload?.role, "owner");
});

test("a token with no issued-at claim is refused", async () => {
  const forged = await new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
  assert.equal(await verifySessionToken(forged), null);
});

test("garbage and missing tokens are refused", async () => {
  assert.equal(await verifySessionToken(undefined), null);
  assert.equal(await verifySessionToken("not-a-jwt"), null);
});

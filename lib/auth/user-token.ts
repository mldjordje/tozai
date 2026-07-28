import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Edge-safe half of the customer session: cookie names, signing and verifying.
// Deliberately free of `server-only` and `next/headers` so middleware (Edge
// runtime) can import it. Cookie writing and `getSessionUser()` live in
// `user-session.ts`, which is Node-only.

export const USER_SESSION_COOKIE = "tozai_user_session";
export const OAUTH_TXN_COOKIE = "tozai_oauth_txn";

export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OAUTH_TXN_TTL_SECONDS = 60 * 10;

export type SessionUser = {
  uid: number;
  email: string;
  name: string | null;
  avatar: string | null;
};

/** `mode` decides what the shared callback does with the code it gets back:
 *  sign somebody in, or store the studio's Calendar refresh token. Both go
 *  through one redirect URI because that URI has to be registered in the
 *  Google console, and one registration is one thing that can be forgotten. */
export type OAuthTxn = {
  state: string;
  verifier: string;
  next: string;
  mode?: "login" | "calendar";
};

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is missing.");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JWTPayload, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(getSecret());
}

export async function verifyToken(token: string | undefined): Promise<JWTPayload | null> {
  if (!token || !process.env.AUTH_JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function signUserSessionToken(user: SessionUser) {
  return signToken({ kind: "user", ...user }, USER_SESSION_TTL_SECONDS);
}

export async function signOAuthTxnToken(txn: OAuthTxn) {
  return signToken({ kind: "oauth-txn", ...txn }, OAUTH_TXN_TTL_SECONDS);
}

export async function verifyOAuthTxnToken(
  token: string | undefined,
): Promise<OAuthTxn | null> {
  const payload = await verifyToken(token);
  if (
    !payload ||
    payload.kind !== "oauth-txn" ||
    typeof payload.state !== "string" ||
    typeof payload.verifier !== "string" ||
    typeof payload.next !== "string"
  ) {
    return null;
  }
  return {
    state: payload.state,
    verifier: payload.verifier,
    next: payload.next,
    mode: payload.mode === "calendar" ? "calendar" : "login",
  };
}

// `kind` is checked here, so an admin token dropped into the customer cookie
// will not validate as a user.
export function toSessionUser(payload: JWTPayload | null): SessionUser | null {
  if (!payload || payload.kind !== "user" || typeof payload.uid !== "number") {
    return null;
  }
  return {
    uid: payload.uid,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : null,
    avatar: typeof payload.avatar === "string" ? payload.avatar : null,
  };
}

export async function verifyUserSession(
  token: string | undefined,
): Promise<SessionUser | null> {
  return toSessionUser(await verifyToken(token));
}

// Only same-origin relative paths may be post-login destinations, so a crafted
// ?next= cannot bounce the user off-site after sign-in.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/nalog";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/nalog";
  }
  return value;
}

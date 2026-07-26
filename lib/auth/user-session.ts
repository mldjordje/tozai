import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  OAUTH_TXN_COOKIE,
  OAUTH_TXN_TTL_SECONDS,
  USER_SESSION_COOKIE,
  USER_SESSION_TTL_SECONDS,
  verifyUserSession,
  type SessionUser,
} from "@/lib/auth/user-token";

// Node-only half of the customer session: reading it off the request and
// writing/clearing the cookies. Token signing/verifying lives in
// `user-token.ts` so middleware can share it on the Edge runtime.

export {
  OAUTH_TXN_COOKIE,
  USER_SESSION_COOKIE,
  safeNextPath,
  signOAuthTxnToken,
  signUserSessionToken,
  toSessionUser,
  verifyOAuthTxnToken,
  verifyUserSession,
  type OAuthTxn,
  type SessionUser,
} from "@/lib/auth/user-token";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

// Reads the current customer session from request cookies (server components,
// route handlers). Returns null when absent/expired/invalid.
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifyUserSession(store.get(USER_SESSION_COOKIE)?.value);
}

export function setUserSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    ...cookieBase,
    name: USER_SESSION_COOKIE,
    value: token,
    maxAge: USER_SESSION_TTL_SECONDS,
  });
}

export function clearUserSessionCookie(response: NextResponse) {
  response.cookies.set({ ...cookieBase, name: USER_SESSION_COOKIE, value: "", maxAge: 0 });
}

export function setOAuthTxnCookie(response: NextResponse, token: string) {
  response.cookies.set({
    ...cookieBase,
    name: OAUTH_TXN_COOKIE,
    value: token,
    maxAge: OAUTH_TXN_TTL_SECONDS,
  });
}

export function clearOAuthTxnCookie(response: NextResponse) {
  response.cookies.set({ ...cookieBase, name: OAUTH_TXN_COOKIE, value: "", maxAge: 0 });
}

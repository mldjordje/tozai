import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "tozai_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is missing.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: JWTPayload) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getSecret());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token || !process.env.AUTH_JWT_SECRET) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

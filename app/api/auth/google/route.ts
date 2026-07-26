import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  safeNextPath,
  setOAuthTxnCookie,
  signOAuthTxnToken,
} from "@/lib/auth/user-session";

export const runtime = "nodejs";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Starts the Google sign-in: generates state + a PKCE pair, stores them in a
// signed short-lived cookie and redirects to Google's consent screen.
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_JWT_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Google auth is not configured." },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  setOAuthTxnCookie(response, await signOAuthTxnToken({ state, verifier, next }));
  return response;
}

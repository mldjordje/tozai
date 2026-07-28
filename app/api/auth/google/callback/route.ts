import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getSql } from "@/lib/db";
import {
  OAUTH_TXN_COOKIE,
  clearOAuthTxnCookie,
  setUserSessionCookie,
  signUserSessionToken,
  verifyOAuthTxnToken,
} from "@/lib/auth/user-session";
import { setSessionCookie, signSessionToken } from "@/lib/auth/session";
import { getStaffByEmail } from "@/lib/staff";
import { isBootstrapAdmin, wantsAdminDestination } from "@/lib/auth/admin-access";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function failRedirect(origin: string, reason: string) {
  const url = new URL("/prijava", origin);
  url.searchParams.set("greska", reason);
  const response = NextResponse.redirect(url);
  clearOAuthTxnCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return failRedirect(origin, "config");
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const txn = await verifyOAuthTxnToken(request.cookies.get(OAUTH_TXN_COOKIE)?.value);

  if (params.get("error") || !code || !state || !txn || txn.state !== state) {
    return failRedirect(origin, "prijava");
  }

  // Exchange the authorization code for tokens (PKCE verifier included).
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: txn.verifier,
    }),
  });
  if (!tokenResponse.ok) {
    return failRedirect(origin, "razmena");
  }
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) {
    return failRedirect(origin, "razmena");
  }

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    }));
  } catch {
    return failRedirect(origin, "token");
  }

  const googleId = typeof claims.sub === "string" ? claims.sub : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!googleId || !email || claims.email_verified !== true) {
    return failRedirect(origin, "email");
  }
  const name = typeof claims.name === "string" ? claims.name : null;
  const avatar = typeof claims.picture === "string" ? claims.picture : null;

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO users (google_id, email, name, avatar_url)
    VALUES (${googleId}, ${email}, ${name}, ${avatar})
    ON CONFLICT (google_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = now()
    RETURNING id, email, name, avatar_url
  `) as { id: number; email: string; name: string | null; avatar_url: string | null }[];
  const user = rows[0];

  const token = await signUserSessionToken({
    uid: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar_url,
  });

  // Team door: if this address is on `staff`, the same Google login also opens
  // the admin panel — set the admin session cookie alongside the customer one
  // and land them in the panel instead of the client dashboard.
  let staffMember = null;
  try {
    staffMember = await getStaffByEmail(email);
  } catch {
    // staff table missing (pre-migration) — treat as a plain customer login.
  }
  const bootstrapAdmin = isBootstrapAdmin(email);
  if (!staffMember && bootstrapAdmin) {
    const seeded = (await sql`
      INSERT INTO staff (email, name, role, active, google_id, avatar_url)
      VALUES (${email.toLowerCase()}, ${name ?? "Owner"}, 'owner', true, ${googleId}, ${avatar})
      ON CONFLICT (email) DO UPDATE
      SET active = true,
          role = 'owner',
          google_id = EXCLUDED.google_id,
          avatar_url = EXCLUDED.avatar_url
      RETURNING id, email, name, role
    `) as { id: number; email: string; name: string; role: "owner" | "staff" }[];
    staffMember = seeded[0] ?? null;
  }

  if (staffMember) {
    await sql`
      UPDATE staff
      SET google_id = ${googleId},
          avatar_url = ${avatar},
          name = CASE WHEN name = '' OR name = 'Owner' THEN COALESCE(${name}, name) ELSE name END
      WHERE id = ${staffMember.id}
    `;
    const adminToken = await signSessionToken({
      role: staffMember.role,
      userId: staffMember.id,
      name: staffMember.name,
    });
    const response = NextResponse.redirect(new URL("/admin", origin));
    clearOAuthTxnCookie(response);
    setUserSessionCookie(response, token);
    setSessionCookie(response, adminToken);
    return response;
  }

  if (wantsAdminDestination(txn.next)) {
    const url = new URL("/admin/login", origin);
    url.searchParams.set("error", "access");
    const response = NextResponse.redirect(url);
    clearOAuthTxnCookie(response);
    setUserSessionCookie(response, token);
    return response;
  }

  const response = NextResponse.redirect(new URL(txn.next, origin));
  clearOAuthTxnCookie(response);
  setUserSessionCookie(response, token);
  return response;
}

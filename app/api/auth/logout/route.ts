import { NextResponse, type NextRequest } from "next/server";
import { clearUserSessionCookie, safeNextPath } from "@/lib/auth/user-session";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

// Signing out of the client dashboard also drops the admin cookie — a staff
// member gets both on Google login, so leaving one door open would be a
// surprise.
function signOut(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next === "/nalog" ? "/" : next, request.nextUrl.origin));
  clearUserSessionCookie(response);
  clearSessionCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}

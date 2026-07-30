import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/auth/user-token";

// Two independent doors, two cookies, and both are Google-only:
//   /admin, /api/admin  → owner session (one allowlisted Google account)
//   /nalog, /api/nalog  → customer session
// Neither cookie grants access to the other's area.

function deny(request: NextRequest, loginPath: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/nalog") || pathname.startsWith("/api/nalog")) {
    const user = await verifyUserSession(request.cookies.get(USER_SESSION_COOKIE)?.value);
    return user ? NextResponse.next() : deny(request, "/prijava");
  }

  // The login page stays public. There is no login API any more — the only way
  // in is the Google round trip, which lands on /api/auth/google/callback.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const role = session?.role === "admin" ? "owner" : session?.role;
  if (role !== "owner" && role !== "staff") {
    return deny(request, "/admin/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/nalog/:path*", "/api/nalog/:path*"],
};

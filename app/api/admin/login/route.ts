import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { setSessionCookie, signSessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";

function passwordMatches(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.AUTH_JWT_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Admin auth nije podešen." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !passwordMatches(password, expected)) {
    return NextResponse.json({ ok: false, message: "Pogrešna lozinka." }, { status: 401 });
  }

  const token = await signSessionToken({ role: "owner", userId: null, name: "Owner" });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);
  return response;
}

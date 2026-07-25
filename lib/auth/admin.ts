import "server-only";
import { cookies } from "next/headers";
import type { JWTPayload } from "jose";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// Admin-panel session. For MVP V1 the only door is the owner's password login
// (temporary password until the client buys the domain). Google OAuth for the
// team ("staff") is wired later; the role field is already carried so that
// switch is a config change, not a rewrite.

export type AdminRole = "owner" | "staff";

export type AdminSession = {
  role: AdminRole;
  userId: number | null;
  name: string | null;
};

export function toAdminSession(payload: JWTPayload | null): AdminSession | null {
  if (!payload) return null;
  const role = payload.role === "admin" ? "owner" : payload.role;
  if (role !== "owner" && role !== "staff") return null;
  return {
    role,
    userId: typeof payload.userId === "number" ? payload.userId : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

// Reads the admin session from request cookies (route handlers, server
// components). Middleware already gates /admin + /api/admin, but routes that
// scope data per role must call this themselves.
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return toAdminSession(await verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value));
}

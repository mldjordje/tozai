import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    role: session.role,
    userId: session.userId,
    name: session.name,
  });
}

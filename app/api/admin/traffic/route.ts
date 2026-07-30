import { NextResponse } from "next/server";
import { getTrafficReport } from "@/lib/traffic";
import { pickDays } from "@/lib/traffic-shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Site traffic, read from Vercel Web Analytics. Sits alongside
// /api/admin/analytics, which reports the database's own sales numbers — the two
// answer different halves of "how is the site doing".
//
// Auth is middleware.ts: the whole /api/admin prefix requires a staff session,
// so there is no check to repeat here.

export async function GET(request: Request) {
  // pickDays whitelists the range — see lib/traffic-shape.ts.
  const days = pickDays(new URL(request.url).searchParams.get("days"));

  const result = await getTrafficReport(days);
  if (result.ok) return NextResponse.json({ ok: true, days, ...result.report });

  // 200 with ok:false on purpose. Missing credentials and a refusing upstream are
  // both states the panel renders as copy — a 5xx here would surface in the tab
  // as "the admin is broken", which is the wrong thing to tell the owner when the
  // only thing missing is a token.
  // `result` already carries ok:false plus its reason and payload.
  return NextResponse.json({ days, ...result });
}

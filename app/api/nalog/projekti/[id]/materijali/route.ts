import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { cleanText } from "@/lib/video-requests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, message: "Neispravan projekat." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const method = body.method === "wetransfer" ? "wetransfer" : body.method === "whatsapp" ? "whatsapp" : null;
  const value = cleanText(body.value, 1000, 5);
  if (!method || !value) {
    return NextResponse.json({ ok: false, message: "Izaberi način i unesi link ili WhatsApp kontakt." }, { status: 400 });
  }
  if (method === "wetransfer") {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/i.test(url.hostname)) throw new Error("host");
    } catch {
      return NextResponse.json({ ok: false, message: "Unesi validan WeTransfer ili we.tl link." }, { status: 400 });
    }
  }

  const sql = getSql();
  const changed = (await sql`
    UPDATE projects
    SET materials_method = ${method}, materials_value = ${value},
        materials_received_at = now(), status = 'u_izradi', updated_at = now()
    WHERE id = ${projectId} AND user_id = ${user.uid}
      AND status = 'onboarding' AND materials_method IS NULL
    RETURNING id
  `) as { id: number }[];
  if (changed.length === 0) {
    return NextResponse.json({ ok: false, message: "Materijali su već poslati ili projekat nije pronađen." }, { status: 409 });
  }
  await sql`
    INSERT INTO project_updates (project_id, status, note, author)
    VALUES (${projectId}, 'u_izradi', ${method === "wetransfer" ? "WeTransfer materijali su poslati." : "Izabran je WhatsApp za preuzimanje materijala."}, 'client')
  `;
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/user-session";
import { cleanText } from "@/lib/video-requests";
import { PROJECT_CLOSED } from "@/lib/format";

// Material hand-off. Repeatable on purpose: WeTransfer links expire after a
// week, clients forget a file, and a revision round needs new source material —
// so every drop is appended and the admin sees the whole history.
//
// WhatsApp is the exception. It is a contact, not a delivery: once we have the
// number the client just messages us again, and a second identical row would be
// noise in the admin's unread badge.

function validWeTransfer(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      /(^|\.)wetransfer\.com$|(^|\.)we\.tl$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

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

  const method =
    body.method === "wetransfer" ? "wetransfer" : body.method === "whatsapp" ? "whatsapp" : null;
  const value = cleanText(body.value, 1000, 5);
  const note = cleanText(body.note, 500);
  if (!method || !value) {
    return NextResponse.json(
      { ok: false, message: "Izaberi način i unesi link ili WhatsApp kontakt." },
      { status: 400 },
    );
  }
  if (method === "wetransfer" && !validWeTransfer(value)) {
    return NextResponse.json(
      { ok: false, message: "Unesi validan WeTransfer ili we.tl link." },
      { status: 400 },
    );
  }

  const sql = getSql();
  const projects = (await sql`
    SELECT id, status FROM projects WHERE id = ${projectId} AND user_id = ${user.uid}
  `) as { id: number; status: string }[];
  const project = projects[0];
  if (!project) {
    return NextResponse.json({ ok: false, message: "Projekat nije pronađen." }, { status: 404 });
  }
  if (PROJECT_CLOSED.includes(project.status)) {
    return NextResponse.json(
      { ok: false, message: "Projekat je zatvoren — javi nam se ako treba nešto da dodaš." },
      { status: 409 },
    );
  }

  const existing = (await sql`
    SELECT id, method, value FROM project_materials
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `) as { id: number; method: string; value: string }[];

  if (method === "whatsapp" && existing.some((row) => row.method === "whatsapp")) {
    return NextResponse.json(
      { ok: false, message: "WhatsApp kontakt je već poslat — piši nam direktno na WhatsApp." },
      { status: 409 },
    );
  }
  if (existing[0]?.method === method && existing[0]?.value === value) {
    return NextResponse.json(
      { ok: false, message: "Taj link je već poslat." },
      { status: 409 },
    );
  }

  await sql`
    INSERT INTO project_materials (project_id, method, value, note)
    VALUES (${projectId}, ${method}, ${value}, ${note || null})
  `;

  // The mirror on projects is the "latest hand-off" summary the list views use.
  // The status only ever moves forward out of onboarding — a later drop must not
  // drag a project in revision back into production.
  await sql`
    UPDATE projects
    SET materials_method = ${method},
        materials_value = ${value},
        materials_received_at = now(),
        status = CASE WHEN status = 'onboarding' THEN 'u_izradi' ELSE status END,
        updated_at = now()
    WHERE id = ${projectId} AND user_id = ${user.uid}
  `;

  const first = existing.length === 0;
  const label =
    method === "whatsapp"
      ? "Izabran je WhatsApp za preuzimanje materijala."
      : first
        ? "WeTransfer materijali su poslati."
        : "Poslat je još jedan WeTransfer link.";
  await sql`
    INSERT INTO project_updates (project_id, status, note, author)
    VALUES (${projectId}, ${first ? "u_izradi" : null}, ${note ? `${label} ${note}` : label}, 'client')
  `;

  return NextResponse.json({ ok: true });
}

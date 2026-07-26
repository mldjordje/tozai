import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { cleanText } from "@/lib/video-requests";
import { queueTransactionalEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The studio's work queue: every paid project, what the client sent, and the
// controls to move it along. Gated by middleware (/api/admin/*).

const STATUSES = ["onboarding", "u_izradi", "na_reviziji", "isporuceno", "otkazano"];

export async function GET() {
  const sql = getSql();
  const projects = await sql`
    SELECT p.id, p.title, p.status, p.brief, p.revisions_left,
           p.due_date::text AS due_date, p.created_at, p.updated_at,
           p.order_id,
           o.amount::float8 AS amount, o.currency, o.paid_at, o.item,
           u.id AS user_id, u.email AS user_email, u.name AS user_name,
           u.phone AS user_phone, u.company_name,
           pk.name AS package_name,
           (SELECT COUNT(*)::int FROM project_materials m WHERE m.project_id = p.id) AS materials_count,
           (SELECT COUNT(*)::int FROM project_materials m
             WHERE m.project_id = p.id AND m.seen_at IS NULL) AS materials_unseen,
           (SELECT COUNT(*)::int FROM project_deliverables d WHERE d.project_id = p.id) AS deliverables_count
    FROM projects p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN orders o ON o.id = p.order_id
    LEFT JOIN packages pk ON pk.id = p.package_id
    ORDER BY
      CASE p.status
        WHEN 'onboarding' THEN 0 WHEN 'u_izradi' THEN 1 WHEN 'na_reviziji' THEN 2
        WHEN 'isporuceno' THEN 3 ELSE 4 END,
      p.due_date NULLS LAST,
      p.created_at DESC
    LIMIT 300
  `;

  // One query for all materials and updates rather than N per project — the
  // list is small enough to join in memory and it keeps the page to 3 round
  // trips regardless of how many projects exist.
  const [materials, updates] = await Promise.all([
    sql`
      SELECT id, project_id, method, value, note, seen_at, created_at
      FROM project_materials ORDER BY created_at DESC LIMIT 1000
    `,
    sql`
      SELECT id, project_id, status, note, author, created_at
      FROM project_updates ORDER BY created_at DESC LIMIT 1000
    `,
  ]);

  return NextResponse.json({ ok: true, projects, materials, updates });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Neispravan zahtev." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, message: "Neispravan ID." }, { status: 400 });
  }
  const sql = getSql();

  /* --- mark the client's hand-off as read ---------------------------------- */
  if (body.action === "seen") {
    await sql`
      UPDATE project_materials SET seen_at = now()
      WHERE project_id = ${id} AND seen_at IS NULL
    `;
    return NextResponse.json({ ok: true });
  }

  /* --- attach a finished file --------------------------------------------- */
  if (body.action === "deliverable") {
    const title = cleanText(body.title, 200, 2);
    const url = cleanText(body.url, 1000, 8);
    if (!title || !url) {
      return NextResponse.json(
        { ok: false, message: "Naziv i link isporuke su obavezni." },
        { status: 400 },
      );
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("scheme");
    } catch {
      return NextResponse.json({ ok: false, message: "Link mora biti https." }, { status: 400 });
    }
    await sql`
      INSERT INTO project_deliverables (project_id, title, url) VALUES (${id}, ${title}, ${url})
    `;
    await sql`
      INSERT INTO project_updates (project_id, note, author)
      VALUES (${id}, ${`Dodata isporuka: ${title}`}, 'admin')
    `;
    return NextResponse.json({ ok: true });
  }

  /* --- status and/or a note ------------------------------------------------ */
  const status = typeof body.status === "string" ? body.status : null;
  const note = cleanText(body.note, 2000);
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, message: "Nepoznat status." }, { status: 400 });
  }
  if (!status && !note) {
    return NextResponse.json({ ok: false, message: "Nema izmena." }, { status: 400 });
  }

  // A revision round costs the client one of the revisions they paid for, and
  // it is decremented here — the single place a project enters that state — so
  // the counter can never drift from the timeline.
  const changed = (await sql`
    UPDATE projects
    SET status = COALESCE(${status}, status),
        revisions_left = CASE
          WHEN ${status} = 'na_reviziji' AND status <> 'na_reviziji' AND revisions_left > 0
            THEN revisions_left - 1
          ELSE revisions_left END,
        updated_at = now()
    WHERE id = ${id}
    RETURNING id, user_id, title, status
  `) as { id: number; user_id: number; title: string; status: string }[];
  const project = changed[0];
  if (!project) {
    return NextResponse.json({ ok: false, message: "Projekat nije pronađen." }, { status: 404 });
  }

  await sql`
    INSERT INTO project_updates (project_id, status, note, author)
    VALUES (${id}, ${status}, ${note || null}, 'admin')
  `;

  // Delivery is the one transition the client should not have to discover by
  // refreshing the dashboard.
  if (status === "isporuceno") {
    const client = (await sql`
      SELECT email, name FROM users WHERE id = ${project.user_id}
    `) as { email: string; name: string | null }[];
    if (client[0]) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      await queueTransactionalEmail({
        userId: project.user_id,
        recipient: client[0].email,
        templateKey: "project_delivered",
        subject: `Isporučeno: ${project.title}`,
        body: [
          `Zdravo ${client[0].name?.split(" ")[0] ?? ""},`,
          "",
          `Projekat "${project.title}" je isporučen.`,
          note ? `\n${note}\n` : "",
          "Preuzmi materijale na svom TOZA AI nalogu:",
          `${baseUrl}/nalog/projekti/${project.id}`,
        ].join("\n"),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

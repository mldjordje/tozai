import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/user-session";
import { getSql } from "@/lib/db";
import { renderStoredInvoice } from "@/lib/invoices/issue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `?prikaz=1` serves the document inline so it can be shown in place — the
// buyer sees the proforma the moment the order is placed, instead of being told
// to go and download it from somewhere else. The default stays `attachment`, so
// the "Preuzmi PDF" links keep saving a file.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const inline = new URL(request.url).searchParams.get("prikaz") === "1";
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Prijava je potrebna." }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "Neispravan dokument." }, { status: 400 });
  }

  const sql = getSql();
  const owned = (await sql`
    SELECT i.id
    FROM invoices i
    JOIN orders o ON o.id = i.order_id
    WHERE i.id = ${id} AND o.user_id = ${user.uid}
  `) as { id: number }[];
  if (owned.length === 0) {
    return NextResponse.json({ ok: false, message: "Dokument nije pronađen." }, { status: 404 });
  }

  const rendered = await renderStoredInvoice(id);
  if (!rendered) {
    return NextResponse.json({ ok: false, message: "PDF nije dostupan." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(rendered.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${rendered.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

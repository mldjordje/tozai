import { NextResponse } from "next/server";
import { renderStoredInvoice } from "@/lib/invoices/issue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ ok: false, message: "Neispravan dokument." }, { status: 400 });
  }

  const rendered = await renderStoredInvoice(id);
  if (!rendered) {
    return NextResponse.json({ ok: false, message: "Dokument nije pronađen." }, { status: 404 });
  }

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(rendered.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${rendered.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB — portfolio holds video too

// Admin upload via Vercel Blob. Degrades to a 501 when storage isn't configured
// yet (no BLOB_READ_WRITE_TOKEN) — the UI then falls back to a URL text input.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, message: "Upload nije podešen (BLOB_READ_WRITE_TOKEN); nalepi URL ručno." },
      { status: 501 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Fajl nije prosleđen" }, { status: 400 });
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ ok: false, message: "Dozvoljene su slike i video" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Fajl je prevelik (max 50MB)" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await put(`portfolio/${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  return NextResponse.json({ ok: true, url: blob.url, type: isVideo ? "video" : "image" }, { status: 201 });
}

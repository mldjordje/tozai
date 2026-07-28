import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

// Client-side upload handshake for the admin panel.
//
// The file does NOT pass through this route: the browser asks here for a
// short-lived signed token, then streams the bytes straight to Vercel Blob.
// That is the whole point — a serverless function caps the request body at
// 4.5MB, which every portfolio video and most result screenshots exceed, and
// the failure only shows up in production. Direct client upload has no such
// ceiling.
//
// Authorisation is the admin session: middleware gates /api/admin/*, so a
// token is only ever issued to someone already inside the panel.

/** Generous enough for a short 4K clip, small enough that a mis-drop cannot
 *  quietly fill the store. */
const MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED = ["image/*", "video/*"];

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, message: "Upload nije podešen (BLOB_READ_WRITE_TOKEN); nalepi URL ručno." },
      { status: 501 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_BYTES,
        // Two uploads of "screenshot.png" must not overwrite each other.
        addRandomSuffix: true,
      }),
      // Fired by Vercel once the bytes have landed. Nothing to record here:
      // the admin UI receives the URL from the upload() call and saves it with
      // the rest of the form, so a completed upload that is never saved is just
      // an orphan blob, not a half-written row.
      //
      // Note this callback cannot reach localhost during development — Vercel
      // calls it over the public internet. Do not put required work in it.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Upload nije uspeo." },
      { status: 400 },
    );
  }
}

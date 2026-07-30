import { upload } from "@vercel/blob/client";

// Browser-side upload helper shared by the admin tabs.
//
// Deliberately not a server module: the bytes go from the browser straight to
// Vercel Blob, and /api/admin/blob/upload only signs the request. Import this
// from client components only.

export type UploadedMedia = {
  url: string;
  pathname: string;
  type: "image" | "video";
};

/** Must match MAX_BYTES in app/api/admin/blob/upload/route.ts. Checked here as
 *  well so an oversized file is refused before it is sent, with a sentence that
 *  says what the limit is — the API's own rejection arrives after the upload
 *  and does not name a number. */
const MAX_BYTES = 200 * 1024 * 1024;

const HANDLE_UPLOAD_URL = "/api/admin/blob/upload";

/**
 * Content type by extension, for when the OS did not supply one.
 *
 * `file.type` is empty surprisingly often on Windows — a screenshot pasted out
 * of some tools, a .webp or .avif whose extension is not in the registry, a file
 * copied off a network share. The SDK then sends `application/octet-stream`,
 * which the signing token's `allowedContentTypes: ["image/*", "video/*"]`
 * rejects, and the studio gets:
 *
 *   Vercel Blob: Content type mismatch, "contentType" application/octet-stream
 *   is not allowed.
 *
 * for a perfectly ordinary PNG. Reproduced against the live store; the fix is to
 * name the type ourselves rather than to widen what the token allows.
 */
const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? "";
}

/** Strips what a URL path cannot carry, keeping the name recognisable in the
 *  Blob dashboard. The random suffix that guarantees uniqueness is added
 *  server-side. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "file";
}

/**
 * Ask the signing route why it refused.
 *
 * The client SDK collapses every non-2xx from handleUploadUrl into one sentence
 * — "Vercel Blob: Failed to retrieve the client token" — so a deployment
 * missing BLOB_READ_WRITE_TOKEN, an expired admin session and a genuine Blob
 * rejection all reach the studio as the same unactionable line. The route
 * already writes a useful message for each; this goes back and reads it.
 *
 * Signing a token has no side effects — nothing is created until bytes are PUT
 * — so asking a second time is free.
 */
async function explainTokenFailure(pathname: string): Promise<string | null> {
  try {
    const res = await fetch(HANDLE_UPLOAD_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: { pathname, clientPayload: null, multipart: false },
      }),
    });
    // It answers now, so the first failure was transient — say so rather than
    // inventing a cause.
    if (res.ok) return "Upload je pao na prolaznoj grešci. Probaj ponovo.";
    if (res.status === 401) {
      return "Admin sesija je istekla. Uloguj se ponovo pa probaj opet.";
    }
    const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof data?.message === "string" ? data.message : "";
    return message
      ? `${message} (HTTP ${res.status})`
      : `Upload servis je odbio zahtev (HTTP ${res.status}).`;
  } catch {
    return null;
  }
}

export async function uploadToBlob(file: File, folder: string): Promise<UploadedMedia> {
  const contentType = contentTypeOf(file);
  const isVideo = contentType.startsWith("video/");
  if (!isVideo && !contentType.startsWith("image/")) {
    throw new Error("Dozvoljene su samo slike i video fajlovi.");
  }
  if (file.size > MAX_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    throw new Error(`Fajl je ${mb}MB — najveći dozvoljeni je 200MB.`);
  }

  const pathname = `${folder}/${safeName(file.name)}`;
  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: HANDLE_UPLOAD_URL,
      contentType,
    });
    return { url: blob.url, pathname: blob.pathname, type: isVideo ? "video" : "image" };
  } catch (error) {
    // Kept in full for whoever is looking at a console; the thrown message is
    // the one the studio reads on the page.
    console.error("[blob] upload failed", { pathname, contentType, size: file.size }, error);
    const raw = error instanceof Error ? error.message : String(error);
    if (/retrieve the client token/i.test(raw)) {
      const why = await explainTokenFailure(pathname);
      if (why) throw new Error(why);
    }
    throw new Error(raw || "Upload nije uspeo.");
  }
}

/** Natural dimensions of an image the studio just picked, read before upload so
 *  the public page can reserve the right box instead of guessing an aspect
 *  ratio. Videos and unreadable files resolve to null rather than throwing —
 *  a missing size must not block a valid upload. */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!contentTypeOf(file).startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

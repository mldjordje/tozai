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

/** Strips what a URL path cannot carry, keeping the name recognisable in the
 *  Blob dashboard. The random suffix that guarantees uniqueness is added
 *  server-side. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "file";
}

export async function uploadToBlob(file: File, folder: string): Promise<UploadedMedia> {
  const isVideo = file.type.startsWith("video/");
  if (!isVideo && !file.type.startsWith("image/")) {
    throw new Error("Dozvoljene su samo slike i video fajlovi.");
  }

  const blob = await upload(`${folder}/${safeName(file.name)}`, file, {
    access: "public",
    handleUploadUrl: "/api/admin/blob/upload",
    contentType: file.type,
  });

  return { url: blob.url, pathname: blob.pathname, type: isVideo ? "video" : "image" };
}

/** Natural dimensions of an image the studio just picked, read before upload so
 *  the public page can reserve the right box instead of guessing an aspect
 *  ratio. Videos and unreadable files resolve to null rather than throwing —
 *  a missing size must not block a valid upload. */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
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

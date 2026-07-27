import "server-only";
import { getSql } from "./db";

// Public slice of `studio_settings` (the row the owner edits in /admin/podesavanja).
// Only the contact/social fields — never the billing ones, which belong to the
// proforma and nowhere else.

export type PublicContact = {
  email: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  linkedin: string | null;
};

const EMPTY: PublicContact = {
  email: null,
  phone: null,
  instagram: null,
  tiktok: null,
  youtube: null,
  linkedin: null,
};

/** The admin field takes either a full URL or a bare handle, because that is
 *  what people paste. Normalized here so the footer never renders a link to
 *  "@tozaai". */
export function socialUrl(base: string, value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}/${v.replace(/^@/, "")}`;
}

// Landing-safe: a settings outage must not take the page down, so an
// unreachable DB reads as "no contact details", same as an unfilled row.
export async function getPublicContact(): Promise<PublicContact> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT email, phone, instagram, tiktok, youtube, linkedin
      FROM studio_settings WHERE id = 1
    `) as PublicContact[];
    return rows[0] ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

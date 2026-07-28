import "server-only";
import { getSql } from "./db";
import { cleanSocialLinks, type SocialLink } from "./socials";

// Public slice of `studio_settings` (the row the owner edits in /admin/podesavanja).
// Only the contact/social fields — never the billing ones, which belong to the
// proforma and nowhere else.

export type PublicContact = {
  email: string | null;
  phone: string | null;
  /** Studio-managed list, in display order. Replaces the four fixed columns:
   *  adding a network is a row now, not a migration. */
  socials: SocialLink[];
};

const EMPTY: PublicContact = {
  email: null,
  phone: null,
  socials: [],
};

// Landing-safe: a settings outage must not take the page down, so an
// unreachable DB reads as "no contact details", same as an unfilled row.
export async function getPublicContact(): Promise<PublicContact> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT email, phone, social_links
      FROM studio_settings WHERE id = 1
    `) as { email: string | null; phone: string | null; social_links: unknown }[];
    const row = rows[0];
    if (!row) return EMPTY;
    return {
      email: row.email,
      phone: row.phone,
      // Cleaned on read as well as on write: a row edited straight in the
      // database must not be able to render a dead icon on the landing.
      socials: cleanSocialLinks(row.social_links),
    };
  } catch {
    return EMPTY;
  }
}

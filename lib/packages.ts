import "server-only";
import { getSql } from "./db";

// A single pricing card. The public cenovnik section and the admin editor share
// this shape (see CENOVNIK-HANDOFF.md). `grp` separates the pricing rails
// ("services" | "education"); add more groups freely.
export type Package = {
  id: number;
  grp: string;
  category: string | null;
  name: string;
  price: number | null;
  currency: string;
  unit: string | null;
  description: string | null;
  features: string[];
  highlighted: boolean;
  cta_label: string | null;
  cta_href: string | null;
  sort: number;
  active: boolean;
};

// Active packages for the public site, ordered for display. Falls back to an
// empty list if the DB is unreachable so the landing never hard-crashes.
export async function getPublicPackages(grp?: string): Promise<Package[]> {
  try {
    const sql = getSql();
    const rows = grp
      ? await sql`
          SELECT id, grp, category, name, price::float8 AS price, currency, unit,
                 description, features, highlighted, cta_label, cta_href, sort, active
          FROM packages WHERE active AND grp = ${grp} ORDER BY sort, id`
      : await sql`
          SELECT id, grp, category, name, price::float8 AS price, currency, unit,
                 description, features, highlighted, cta_label, cta_href, sort, active
          FROM packages WHERE active ORDER BY grp, sort, id`;
    return rows as Package[];
  } catch {
    return [];
  }
}

// Every package (incl. inactive) for the admin editor.
export async function getAllPackages(): Promise<Package[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, grp, category, name, price::float8 AS price, currency, unit,
           description, features, highlighted, cta_label, cta_href, sort, active
    FROM packages ORDER BY grp, sort, id`;
  return rows as Package[];
}

import "server-only";
import { getSql } from "./db";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

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
  /** Checkout URL segment: /porudzbina/[slug]. */
  slug: string | null;
  /** What a purchase produces: a project to deliver, or hours in the wallet. */
  flow: string;
  /** Hours credited for flow='hours'. Null for project packages. */
  hours: number | null;
  /** Revision rounds included in a quoted project. */
  revisions: number;
  // The English side. Only read back by the admin editor — the public reads go
  // through packageColumns(), which resolves one language into the plain
  // fields above, so a section component never has to know which it got.
  name_en?: string | null;
  category_en?: string | null;
  unit_en?: string | null;
  description_en?: string | null;
  cta_label_en?: string | null;
  features_en?: string[];
};

// English falls back to Serbian per field, not per row: a studio that has
// translated the name but not the feature list should get the English name and
// the Serbian bullets, rather than the whole card reverting.
const EN_TEXT = {
  name: "COALESCE(NULLIF(btrim(name_en), ''), name)",
  category: "COALESCE(NULLIF(btrim(category_en), ''), category)",
  unit: "COALESCE(NULLIF(btrim(unit_en), ''), unit)",
  description: "COALESCE(NULLIF(btrim(description_en), ''), description)",
  cta_label: "COALESCE(NULLIF(btrim(cta_label_en), ''), cta_label)",
  features: "CASE WHEN cardinality(features_en) > 0 THEN features_en ELSE features END",
} as const;

/** The SELECT list, with the English columns folded in when asked for. Written
 *  as a string because the locale picks *columns*, which a tagged-template
 *  parameter cannot do. Nothing here comes from a request. */
function packageColumns(locale: Locale): string {
  const t = locale === "en" ? EN_TEXT : null;
  return `
    id, grp,
    ${t ? t.category : "category"} AS category,
    ${t ? t.name : "name"} AS name,
    price::float8 AS price, currency,
    ${t ? t.unit : "unit"} AS unit,
    ${t ? t.description : "description"} AS description,
    ${t ? t.features : "features"} AS features,
    highlighted,
    ${t ? t.cta_label : "cta_label"} AS cta_label,
    cta_href, sort, active, slug, flow, hours::float8 AS hours, revisions
  `;
}

// Active packages for the public site, ordered for display. Falls back to an
// empty list if the DB is unreachable so the landing never hard-crashes.
export async function getPublicPackages(
  grp?: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Package[]> {
  try {
    const sql = getSql();
    const columns = packageColumns(locale);
    const rows = grp
      ? await sql.query(
          `SELECT ${columns} FROM packages WHERE active AND grp = $1 ORDER BY sort, id`,
          [grp],
        )
      : await sql.query(
          `SELECT ${columns} FROM packages WHERE active ORDER BY grp, sort, id`,
        );
    return rows as Package[];
  } catch {
    return [];
  }
}

// Every package (incl. inactive) for the admin editor, which is the one caller
// that wants both languages side by side rather than one resolved for display.
export async function getAllPackages(): Promise<Package[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, grp, category, name, price::float8 AS price, currency, unit,
           description, features, highlighted, cta_label, cta_href, sort, active,
           slug, flow, hours::float8 AS hours, revisions,
           name_en, category_en, unit_en, description_en, cta_label_en, features_en
    FROM packages ORDER BY grp, sort, id`;
  return rows as Package[];
}

// One package by its checkout slug. Only active packages are purchasable — an
// inactive slug must 404 rather than quietly sell something that was retired.
export async function getPackageBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Package | null> {
  try {
    const sql = getSql();
    const rows = (await sql.query(
      `SELECT ${packageColumns(locale)} FROM packages WHERE active AND slug = $1 LIMIT 1`,
      [slug],
    )) as Package[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

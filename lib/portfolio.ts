import "server-only";
import { getSql } from "@/lib/db";

// Public read of the portfolio. Works are published YouTube Shorts (media_type
// 'youtube'); hosted files stay supported for anything that never went up on
// YouTube.

export type PortfolioCategory = { id: number; name: string; slug: string };

export type PortfolioWork = {
  id: number;
  category_id: number | null;
  title: string;
  client: string | null;
  media_url: string;
  media_type: string;
  youtube_id: string | null;
  poster_url: string | null;
  description: string | null;
};

export type PublicPortfolio = {
  categories: PortfolioCategory[];
  works: PortfolioWork[];
};

const EMPTY: PublicPortfolio = { categories: [], works: [] };

/**
 * `featured` is the studio's visibility switch (labelled "Prikaži na sajtu" in
 * the panel), so an unfinished work can sit in the admin without appearing.
 *
 * Categories are filtered down to the ones that actually have a visible work:
 * a filter chip that yields an empty grid is a bug the visitor has to discover
 * by clicking.
 *
 * Page-safe: an unreachable database renders an empty portfolio rather than a
 * 500.
 */
export async function getPublicPortfolio(): Promise<PublicPortfolio> {
  try {
    const sql = getSql();
    const works = (await sql`
      SELECT id, category_id, title, client, media_url, media_type, youtube_id, poster_url, description
      FROM portfolio_works
      WHERE featured AND (media_type <> 'youtube' OR youtube_id IS NOT NULL)
      ORDER BY sort, id
    `) as PortfolioWork[];

    const categories = (await sql`
      SELECT c.id, c.name, c.slug
      FROM portfolio_categories c
      WHERE EXISTS (
        SELECT 1 FROM portfolio_works w
        WHERE w.category_id = c.id AND w.featured
      )
      ORDER BY c.sort, c.id
    `) as PortfolioCategory[];

    return { categories, works };
  } catch {
    return EMPTY;
  }
}

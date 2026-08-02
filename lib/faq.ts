import "server-only";
import { getSql } from "@/lib/db";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export type FaqItem = {
  id: number;
  question: string;
  answer: string;
};

/**
 * Active FAQ rows, one language resolved. English falls back to Serbian per
 * field, same as getPublicResultShots — a studio that has translated the
 * question but not the answer yet should get the English question with the
 * Serbian answer, not the whole row reverting.
 *
 * Falls back to an empty list if the DB is unreachable, so the landing never
 * hard-crashes over a section that is allowed to simply not render.
 */
export async function getPublicFaq(locale: Locale = DEFAULT_LOCALE): Promise<FaqItem[]> {
  try {
    const sql = getSql();
    const columns =
      locale === "en"
        ? `COALESCE(NULLIF(btrim(question_en), ''), question) AS question,
           COALESCE(NULLIF(btrim(answer_en), ''), answer) AS answer`
        : `question, answer`;
    return (await sql.query(`
      SELECT id, ${columns}
      FROM faq
      WHERE active
      ORDER BY sort, id
    `)) as FaqItem[];
  } catch {
    return [];
  }
}

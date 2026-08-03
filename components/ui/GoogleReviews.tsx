import { Star } from "lucide-react";
import { ui } from "@/lib/i18n/ui";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Link out to the studio's Google Business profile.
 *
 * Two things this buys, and neither of them is decoration:
 *
 *   1. a buyer who wants a second opinion currently has nowhere to go — the
 *      proof rail is our own screenshots, and a review nobody can find does not
 *      count as proof;
 *   2. the profile is the one piece of the studio's presence that a platform
 *      reviewer can verify without taking our word for it, which is the whole
 *      point after the Instagram restriction (see the COPY RULE in
 *      lib/content/landing.ts).
 *
 * The Place ID is the stable identifier for the profile — the name, the address
 * and the CID can all change under it, so the two URLs below keep working. It is
 * public data (it ships in every Maps embed), which is why it sits in the source
 * rather than in an env var.
 *
 * `mode="write"` opens the review composer straight away; `mode="read"` opens
 * the list of reviews already left. Both are Google's own endpoints, so neither
 * needs an API key or a quota.
 *
 * No count and no star average is printed anywhere here. We do not read the
 * Places API, so any number on the page would be one we cannot show the source
 * of — exactly the kind of claim the copy rule exists to keep off the site.
 */
export const GOOGLE_PLACE_ID = "ChIJd4z6zh25VUcR-13hZr9qou4";

export const GOOGLE_REVIEW_URLS = {
  write: `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`,
  read: `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`,
} as const;

export default function GoogleReviews({
  locale = DEFAULT_LOCALE,
  mode = "write",
  className = "",
}: {
  locale?: Locale;
  mode?: "write" | "read";
  className?: string;
}) {
  const t = ui(locale).reviews;

  return (
    <a
      href={GOOGLE_REVIEW_URLS[mode]}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 rounded-full border border-line bg-bg-elev/40 px-5 py-3 text-sm text-fg backdrop-blur-md transition-[border-color,background-color] duration-500 hover:border-accent-soft/70 hover:bg-bg-elev/70 ${className}`}
    >
      {/* Five outlines, not a filled rating: the row says "reviews live here",
          it does not claim a score we have not measured. */}
      <span className="flex items-center gap-0.5 text-amber-300" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={13} strokeWidth={1.75} />
        ))}
      </span>
      <span>{mode === "write" ? t.write : t.read}</span>
    </a>
  );
}

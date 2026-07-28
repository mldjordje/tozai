import { DEFAULTS } from "@/lib/content/landing";

/**
 * Big outlined text marquee — section divider with motion. Decorative.
 *
 * The separator is added here rather than typed into every admin field: the
 * studio edits words, not punctuation.
 */
export default function TextStrip({ items: words = DEFAULTS.strip_items }: { items?: string[] } = {}) {
  const items = `${words.join(" ✦ ")} ✦ `;
  return (
    <div aria-hidden className="relative select-none overflow-hidden py-6 md:py-10">
      <div className="marquee-track flex w-max whitespace-nowrap [animation-duration:36s]">
        <span className="text-strip">{items.repeat(2)}</span>
        <span className="text-strip">{items.repeat(2)}</span>
      </div>
    </div>
  );
}

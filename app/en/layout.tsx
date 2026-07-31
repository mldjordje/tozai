import type { ReactNode } from "react";
import DocumentLang from "@/components/providers/DocumentLang";

/**
 * The root layout owns the single <html> element and serves both URL trees, so
 * it emits the Serbian document language and this segment corrects it.
 *
 * The correction runs after hydration rather than from an inline script. An
 * inline script rewrites `documentElement.lang` before React hydrates, which
 * React then reports as a hydration mismatch on every English page — a real
 * error in the console, on a page whose only job right now is to look
 * trustworthy to whoever opens it.
 *
 * `<div lang="en">` is the part that matters for correctness: it is in the
 * server HTML, so assistive technology and any crawler reading the markup get
 * the language of the content itself even with scripts disabled. The hreflang
 * pair is declared separately in landingMetadata(), which is what a search
 * engine actually reads to pair the two URLs.
 */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DocumentLang lang="en" />
      <div lang="en">{children}</div>
    </>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Sets the <html lang> for a language segment whose pages share the root
 * layout's single <html> element.
 *
 * Applied in an effect, after hydration, so the server HTML and React's first
 * client render agree — setting it earlier is what produced a hydration
 * mismatch error on every /en page. It restores the previous value on unmount,
 * so a client-side navigation from /en back to a Serbian route does not leave
 * the document claiming English.
 */
export default function DocumentLang({ lang }: { lang: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  return null;
}

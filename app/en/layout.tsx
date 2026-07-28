import type { ReactNode } from "react";

/**
 * The root layout serves both URL trees and therefore emits the Serbian
 * document language by default. Set it as soon as the English segment parses,
 * before interactive components hydrate, and also mark the segment wrapper so
 * assistive technology has the correct language even if scripts are disabled.
 */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.lang="en"' }} />
      <div lang="en">{children}</div>
    </>
  );
}

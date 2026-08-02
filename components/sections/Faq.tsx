"use client";

import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import type { FaqItem } from "@/lib/faq";

/**
 * #faq — questions and answers, admin-driven (the `faq` table, /admin/faq).
 *
 * Native <details>/<summary> rather than a scripted accordion: the answer text
 * sits in the DOM from first paint regardless of JavaScript, which is what both
 * a search crawler and an AI answer engine actually read — a client-side
 * expand-on-click would hide the content from anything that does not run the
 * page's JS. The matching FAQPage JSON-LD is emitted by the caller (Landing),
 * next to the same rows.
 *
 * Renders nothing when the studio has not added a question yet. An empty
 * "Pitanja" section with no cards under it is worse than no section.
 */
export default function Faq({
  locale: _locale,
  items,
  eyebrow,
  title,
}: {
  locale?: string;
  items: FaqItem[];
  eyebrow: string;
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <section
      id="faq"
      className="relative flex min-h-[100svh] items-center px-6 py-28 md:px-12"
    >
      <div className="w-full max-w-3xl">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <KineticTitle text={title} className="display mb-14 max-w-2xl text-4xl md:mb-20 md:text-6xl" />

        <div className="divide-y divide-line border-y border-line">
          {items.map((item, i) => (
            <Reveal key={item.id} delay={Math.min(i * 0.04, 0.3)}>
              <details className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-medium text-fg marker:content-none md:text-lg">
                  {item.question}
                  <span
                    aria-hidden
                    className="relative h-4 w-4 shrink-0 text-accent-soft"
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                        <path d="M5 12h14" />
                      </svg>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-open:rotate-90">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                        <path d="M12 5v14" />
                      </svg>
                    </span>
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted md:text-base">
                  {item.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

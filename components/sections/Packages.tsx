"use client";

import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import CTAButton from "@/components/ui/CTAButton";
import { CLIP_PACKAGES, type ClipPackage } from "@/lib/content/offerings";
import { DEFAULTS } from "@/lib/content/landing";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

/**
 * #paketi — choose an AI-video scope and send a brief. Project pricing is
 * intentionally private because it depends on the requested clip count,
 * complexity and turnaround.
 *
 * Tiers come from the packages table; the surrounding copy from
 * site_content['landing'] (see lib/content/landing.ts).
 */
export default function Packages({
  locale = DEFAULT_LOCALE,
  packages = CLIP_PACKAGES,
  eyebrow = DEFAULTS.packages_eyebrow,
  title = DEFAULTS.packages_title,
  body = DEFAULTS.packages_body,
  note = DEFAULTS.packages_note,
}: {
  locale?: Locale;
  packages?: ClipPackage[];
  eyebrow?: string;
  title?: string;
  body?: string;
  note?: string;
}) {
  const t = ui(locale).packages;
  return (
    <section
      id="paketi"
      className="relative flex min-h-[100svh] items-center px-6 py-28 md:px-12"
    >
      <div className="w-full max-w-6xl">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <KineticTitle text={title} className="display mb-5 max-w-2xl text-4xl md:text-7xl" />
        <Reveal delay={0.1}>
          <p className="mb-16 max-w-xl text-muted md:mb-20 md:text-lg">{body}</p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {packages.map((pkg, i) => (
            <Reveal key={pkg.id} delay={i * 0.08}>
              <div
                className={`group relative flex h-full flex-col rounded-2xl border p-7 backdrop-blur-md transition-colors duration-300 ${
                  pkg.featured
                    ? "border-accent/60 bg-accent/[0.06]"
                    : "border-line bg-bg-elev/40 hover:border-accent-soft/60"
                }`}
              >
                {pkg.featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                    {t.popular}
                  </span>
                )}

                <div className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
                  {pkg.name}
                </div>

                <div className="mt-5">
                  <span className="inline-flex rounded-full border border-line px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-accent-soft">
                    {t.privateQuote}
                  </span>
                </div>

                <div className="mt-2 text-sm text-fg/90">{pkg.headline}</div>

                <ul className="mt-7 flex-1 space-y-3 border-t border-line pt-7">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex gap-3 text-sm text-muted">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft"
                        aria-hidden
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <CTAButton
                    href={pkg.slug ? localePath(locale, `/porudzbina/${pkg.slug}`) : "#booking"}
                    variant={pkg.featured ? "primary" : "ghost"}
                  >
                    {pkg.cta}
                  </CTAButton>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-faint">{note}</p>
      </div>
    </section>
  );
}

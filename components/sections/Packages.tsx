"use client";

import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import CTAButton from "@/components/ui/CTAButton";
import { CLIP_PACKAGES, type ClipPackage } from "@/lib/content/offerings";

/**
 * #paketi — buy AI-clip packages. Tiers/prices come from the admin panel via
 * the `packages` table (passed as props by the server page); falls back to the
 * static CLIP_PACKAGES placeholders when the DB has no active service rows.
 */
export default function Packages({ packages = CLIP_PACKAGES }: { packages?: ClipPackage[] }) {
  return (
    <section
      id="paketi"
      className="relative flex min-h-[100svh] items-center px-6 py-28 md:px-12"
    >
      <div className="w-full max-w-6xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft">
          02 — Paketi
        </p>
        <KineticTitle
          text="Kupi AI klipove. Bez čekanja."
          className="mb-5 max-w-2xl text-3xl font-semibold tracking-tighter md:text-6xl"
        />
        <Reveal delay={0.1}>
          <p className="mb-16 max-w-xl text-muted md:mb-20 md:text-lg">
            Izaberi paket, mi napravimo klipove za tvoj brend. Vertikalni
            format spreman za objavu.
          </p>
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
                    Najpopularnije
                  </span>
                )}

                <div className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
                  {pkg.name}
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tighter tabular-nums md:text-5xl">
                    {pkg.price}
                  </span>
                  {pkg.priceNote && (
                    <span className="mb-1.5 text-sm text-muted">
                      {pkg.priceNote}
                    </span>
                  )}
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
                    href="#booking"
                    variant={pkg.featured ? "primary" : "ghost"}
                  >
                    {pkg.cta}
                  </CTAButton>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* TODO(admin): prices above are placeholders; wire to admin-editable
            source (see lib/content/offerings.ts). */}
      </div>
    </section>
  );
}

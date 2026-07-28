"use client";

import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import CTAButton from "@/components/ui/CTAButton";
import { HOUR_PACKS, type HourPack } from "@/lib/content/offerings";
import { DEFAULTS } from "@/lib/content/landing";

/**
 * #edukacija — 1-on-1 education sold as hour-packs. Tiers come from the admin
 * panel via the `packages` table (education rail, passed as props); falls back
 * to the static HOUR_PACKS placeholders when the DB has no active edu rows.
 * Copy comes from site_content['landing'] the same way.
 */
export default function Education({
  packs = HOUR_PACKS,
  eyebrow = DEFAULTS.education_eyebrow,
  title = DEFAULTS.education_title,
  body = DEFAULTS.education_body,
  pills = DEFAULTS.education_pills,
}: {
  packs?: HourPack[];
  eyebrow?: string;
  title?: string;
  body?: string;
  pills?: string[];
}) {
  return (
    <section
      id="edukacija"
      className="relative flex min-h-[100svh] items-center px-6 py-28 md:px-12"
    >
      <div className="w-full max-w-6xl">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <KineticTitle text={title} className="display max-w-3xl text-4xl md:text-7xl" />
        <Reveal delay={0.12}>
          <p className="mt-7 max-w-xl text-muted md:text-lg">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {pills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-line bg-bg-elev/40 px-4 py-2 text-sm text-fg/90 backdrop-blur-md"
              >
                {pill}
              </span>
            ))}
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 md:mt-20 md:grid-cols-3">
          {packs.map((pack, i) => (
            <Reveal key={pack.id} delay={i * 0.08}>
              <div
                className={`group flex h-full flex-col rounded-2xl border p-7 backdrop-blur-md transition-colors duration-300 ${
                  pack.featured
                    ? "border-accent/60 bg-accent/[0.06]"
                    : "border-line bg-bg-elev/40 hover:border-accent-soft/60"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
                    {pack.label}
                  </span>
                  <span className="text-sm text-accent-soft">
                    {pack.hours}
                    {pack.hours === 1 ? " sat" : " sati"}
                  </span>
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tighter tabular-nums md:text-5xl">
                    {pack.price}
                  </span>
                  {pack.perHour && (
                    <span className="mb-1.5 text-sm text-muted">
                      {pack.perHour}
                    </span>
                  )}
                </div>

                {pack.note && (
                  <p className="mt-4 flex-1 text-sm text-muted">{pack.note}</p>
                )}

                <div className="mt-8">
                  <CTAButton
                    href={pack.slug ? `/porudzbina/${pack.slug}` : "#booking"}
                    variant={pack.featured ? "primary" : "ghost"}
                  >
                    {pack.slug ? "Kupi sate" : "Rezerviši"}
                  </CTAButton>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* TODO(admin): hour-pack prices are placeholders; wire to
            admin-editable source (see lib/content/offerings.ts). */}
      </div>
    </section>
  );
}

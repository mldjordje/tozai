import LatentBackground from "@/components/background/LatentBackground";
import Nav from "@/components/layout/Nav";
import PinnedSection from "@/components/layout/PinnedSection";
import Preloader from "@/components/ui/Preloader";
import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import CountUp from "@/components/ui/CountUp";
import CTAButton from "@/components/ui/CTAButton";
import TextStrip from "@/components/ui/TextStrip";
import Hero from "@/components/sections/Hero";
import ResultsShowcase from "@/components/sections/ResultsShowcase";
import Packages from "@/components/sections/Packages";
import Education from "@/components/sections/Education";
import { getPublicPackages } from "@/lib/packages";
import { toClipPackage, toHourPack } from "@/lib/content/offerings";

// Pricing is admin-driven (packages table). ISR keeps the landing fast; the
// admin write routes revalidatePath("/") so edits go live within a click.
export const revalidate = 60;

const STATS = [
  { value: "16M+", label: "Monthly Views" },
  { value: "5000+", label: "AI Videos Created" },
  { value: "100+", label: "Clients" },
  { value: "2+", label: "Years Creating Content" },
];

export default async function Home() {
  const [services, education] = await Promise.all([
    getPublicPackages("services"),
    getPublicPackages("education"),
  ]);
  const clipPackages = services.map(toClipPackage);
  const hourPacks = education.map(toHourPack);

  return (
    <>
      <Preloader />
      <LatentBackground />
      <Nav />

      <main className="relative">
        <Hero />

        {/* Brojevi */}
        <PinnedSection id="services">
          <div className="w-full max-w-6xl">
            <p className="eyebrow mb-5">01 — Brojevi</p>
            <KineticTitle
              text="Brojevi koji rade *za sebe*."
              className="display mb-16 max-w-2xl text-4xl md:mb-24 md:text-7xl"
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-4">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.09}>
                  <CountUp
                    value={s.value}
                    className="text-5xl font-semibold tracking-tighter tabular-nums md:text-7xl"
                  />
                  <div className="mt-3 border-t border-line pt-3 text-sm text-muted md:text-base">
                    {s.label}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </PinnedSection>

        <TextStrip />

        {/* Proof — pinned horizontal showcase */}
        <ResultsShowcase />

        {/* Paketi — buy AI clips (admin-driven, static fallback) */}
        <Packages packages={clipPackages.length ? clipPackages : undefined} />

        {/* Edukacija — buy 1-on-1 hour packs (admin-driven, static fallback) */}
        <Education packs={hourPacks.length ? hourPacks : undefined} />

        {/* Booking */}
        <PinnedSection id="booking" hold={0.7} className="justify-center text-center">
          <div>
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg-elev/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Odgovaramo u roku od 24h
              </p>
            </Reveal>
            <KineticTitle
              text="Hajde da napravimo *tvoj sadržaj*."
              className="display mx-auto max-w-4xl text-5xl md:text-8xl"
            />
            <Reveal delay={0.25}>
              <div className="mt-10">
                <CTAButton href="#top" size="lg">
                  Book a Call
                </CTAButton>
              </div>
            </Reveal>
          </div>
        </PinnedSection>
      </main>
    </>
  );
}

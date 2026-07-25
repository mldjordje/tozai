import LatentBackground from "@/components/background/LatentBackground";
import Nav from "@/components/layout/Nav";
import ScrollProgress from "@/components/ui/ScrollProgress";
import GrainOverlay from "@/components/ui/GrainOverlay";
import CursorGlow from "@/components/ui/CursorGlow";
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

const STATS = [
  { value: "16M+", label: "Monthly Views" },
  { value: "5000+", label: "AI Videos Created" },
  { value: "100+", label: "Clients" },
  { value: "2+", label: "Years Creating Content" },
];

export default function Home() {
  return (
    <>
      <Preloader />
      <LatentBackground />
      <GrainOverlay />
      <CursorGlow />
      <ScrollProgress />
      <Nav />

      <main className="relative">
        <Hero />

        {/* Brojevi */}
        <section
          id="services"
          className="relative flex min-h-[100svh] items-center px-6 py-28 md:px-12"
        >
          <div className="w-full max-w-6xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft">
              01 — Brojevi
            </p>
            <KineticTitle
              text="Brojevi koji rade za sebe."
              className="mb-16 max-w-2xl text-3xl font-semibold tracking-tighter md:mb-24 md:text-6xl"
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
        </section>

        <TextStrip />

        {/* Proof — pinned horizontal showcase */}
        <ResultsShowcase />

        {/* Paketi — buy AI clips */}
        <Packages />

        {/* Edukacija — buy 1-on-1 hour packs */}
        <Education />

        {/* Booking */}
        <section
          id="booking"
          className="relative flex min-h-[90svh] items-center justify-center px-6 py-28 text-center"
        >
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
              text="Hajde da napravimo tvoj sadržaj."
              className="mx-auto max-w-4xl text-4xl font-semibold tracking-tighter md:text-7xl"
            />
            <Reveal delay={0.25}>
              <div className="mt-10">
                <CTAButton href="#top" size="lg">
                  Book a Call
                </CTAButton>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}

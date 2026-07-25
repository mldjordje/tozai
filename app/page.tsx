import Image from "next/image";
import LatentBackground from "@/components/background/LatentBackground";
import Nav from "@/components/layout/Nav";
import ScrollProgress from "@/components/ui/ScrollProgress";
import GrainOverlay from "@/components/ui/GrainOverlay";
import Reveal from "@/components/ui/Reveal";
import Magnetic from "@/components/ui/Magnetic";
import Hero from "@/components/sections/Hero";

const STATS = [
  { value: "16M+", label: "Monthly Views" },
  { value: "5000+", label: "AI Videos Created" },
  { value: "100+", label: "Clients" },
  { value: "2+", label: "Years Creating Content" },
];

export default function Home() {
  return (
    <>
      <LatentBackground />
      <GrainOverlay />
      <ScrollProgress />
      <Nav />

      <main className="relative">
        <Hero />

        {/* Brojevi */}
        <section
          id="services"
          className="relative flex min-h-[100svh] items-center px-6 md:px-12"
        >
          <div className="w-full max-w-6xl">
            <Reveal>
              <h2 className="mb-14 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
                Brojevi koji <span className="text-accent">rade</span> za sebe.
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.08}>
                  <div className="text-4xl font-semibold tracking-tight md:text-6xl">
                    {s.value}
                  </div>
                  <div className="mt-2 text-sm text-muted md:text-base">
                    {s.label}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Proof — pravi screenshot analitike */}
        <section
          id="portfolio"
          className="relative flex min-h-[100svh] items-center px-6 md:px-12"
        >
          <div className="grid w-full max-w-6xl items-center gap-12 md:grid-cols-2">
            <Reveal>
              <div>
                <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft">
                  Real rezultati
                </p>
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Svaki kadar je AI. <br /> Svaki broj je stvaran.
                </h2>
                <p className="mt-6 max-w-md text-muted">
                  Desetine hiljada lajkova po objavi. Sadržaj koji je 100%
                  AI-generisan i i dalje postaje viralan.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="relative mx-auto w-full max-w-[320px]">
                <div className="overflow-hidden rounded-[2rem] border border-line shadow-2xl shadow-black/60">
                  <Image
                    src="/media/rezultati.png"
                    alt="TikTok Insights — viralni AI video rezultati"
                    width={853}
                    height={1600}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Edukacija (placeholder anchor) */}
        <section
          id="edukacija"
          className="relative flex min-h-[80svh] items-center px-6 md:px-12"
        >
          <Reveal>
            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft">
                Privatna edukacija
              </p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Nauči da praviš sadržaj koji prodaje.
              </h2>
              <p className="mt-6 text-muted">
                1-na-1 mentorstvo. Kupuješ sate, rezervišeš termin, učiš tačno
                ono što tvom biznisu treba.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Booking anchor */}
        <section
          id="booking"
          className="relative flex min-h-[85svh] items-center justify-center px-6 text-center"
        >
          <Reveal>
            <div>
              <h2 className="text-4xl font-semibold tracking-tight md:text-6xl">
                Hajde da napravimo <br /> tvoj sadržaj.
              </h2>
              <Magnetic className="mt-8 inline-block">
                <a
                  href="#top"
                  className="inline-block rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white transition-colors duration-300 hover:bg-accent-soft"
                >
                  Book a Call
                </a>
              </Magnetic>
            </div>
          </Reveal>
        </section>
      </main>
    </>
  );
}

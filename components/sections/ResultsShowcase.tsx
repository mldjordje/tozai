"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import KineticTitle from "@/components/ui/KineticTitle";
import CTAButton from "@/components/ui/CTAButton";

/**
 * Proof showcase — the section pins while vertical scroll drives the card
 * train horizontally. Works identically with thumb-scroll on mobile and
 * wheel on desktop (no horizontal-touch conflicts). Scroll velocity skews
 * the train; a progress line tracks position.
 */
const SHOTS = [
  {
    src: "/media/results/ig-toza.png",
    alt: "toza.aii — Instagram profil, 187K pratilaca, verifikovan",
    handle: "toza.aii",
    stat: "187K pratilaca · Instagram",
    wide: true,
  },
  {
    src: "/media/results/tt-toza.png",
    alt: "Toza Ai — TikTok profil, 69.5K pratilaca, 609K lajkova",
    handle: "@tozaai",
    stat: "69.5K pratilaca · 609K lajkova",
    wide: false,
  },
  {
    src: "/media/rezultati.png",
    alt: "TikTok Insights — desetine hiljada lajkova po objavi",
    handle: "TikTok Insights",
    stat: "43K+ lajkova po objavi",
    wide: false,
  },
  {
    src: "/media/results/tt-darija.png",
    alt: "Darija Ai — TikTok profil, 22.1K pratilaca, 753K lajkova",
    handle: "@darijaaai",
    stat: "22.1K pratilaca · 753K lajkova",
    wide: false,
  },
  {
    src: "/media/results/ig-kaja.png",
    alt: "Kaja Sretic — Instagram AI profil, 12.3K pratilaca",
    handle: "kajasretic",
    stat: "12.3K pratilaca · Instagram",
    wide: true,
  },
  {
    src: "/media/results/tt-kajina.png",
    alt: "kajina.perspektiva — TikTok profil, 15.3K pratilaca, 183K lajkova",
    handle: "kajina.perspektiva",
    stat: "15.3K pratilaca · 183K lajkova",
    wide: false,
  },
];

function Card({ shot, index }: { shot: (typeof SHOTS)[number]; index: number }) {
  return (
    <div className="group relative shrink-0">
      {/* Oversized ghost index behind each card */}
      <span className="pointer-events-none absolute -top-12 left-1 select-none text-7xl font-bold tracking-tighter text-fg/[0.06] md:-top-16 md:text-9xl">
        0{index + 1}
      </span>
      <div
        className={`relative overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/60 md:rounded-3xl ${
          shot.wide
            ? "w-[76vw] max-w-[340px] md:w-[400px] md:max-w-none"
            : "w-[62vw] max-w-[260px] md:w-[280px] md:max-w-none"
        }`}
      >
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.wide ? 1358 : 853}
          height={shot.wide ? 1158 : 1846}
          className="h-auto w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.045]"
          sizes="(max-width: 768px) 76vw, 400px"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-14">
          <div className="text-sm font-semibold md:text-base">{shot.handle}</div>
          <div className="mt-0.5 text-xs text-muted md:text-sm">{shot.stat}</div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsShowcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // Sticky (100svh) unpins when parent bottom reaches viewport bottom, i.e.
  // at progress (H-100)/H. With H=320svh that's ~0.69 — the card train must
  // finish its horizontal travel by then, or the last cards never show while
  // pinned. So map travel into [0.03, 0.69], not [0, 1].
  const x = useSpring(
    useTransform(scrollYProgress, [0.03, 0.69], ["1%", "-80%"]),
    { stiffness: 70, damping: 22, mass: 0.4 },
  );
  // Scroll velocity skews the whole train — the drag has weight.
  const skewX = useSpring(
    useTransform(useVelocity(scrollYProgress), [-1.2, 1.2], [7, -7]),
    { stiffness: 140, damping: 24 },
  );
  const lineScale = useTransform(scrollYProgress, [0.03, 0.69], [0, 1]);

  return (
    <section id="portfolio" ref={ref} className="relative h-[320svh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden pt-24 md:pt-28">
        <div className="px-6 md:px-12">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft">
            Real rezultati
          </p>
          <KineticTitle
            text="Svaki kadar je AI. Svaki broj je stvaran."
            className="display max-w-3xl text-4xl md:text-7xl"
          />
          <p className="mt-4 max-w-md text-sm text-muted md:mt-6 md:text-base">
            300K+ pratilaca i 100+ miliona pregleda na profilima koje vodimo —
            skroluj i pregledaj dokaze.
          </p>
        </div>

        <motion.div
          style={{ x, skewX }}
          className="mt-16 flex w-max items-center gap-6 pl-6 will-change-transform md:mt-24 md:gap-10 md:pl-12"
        >
          {SHOTS.map((shot, i) => (
            <Card key={shot.src} shot={shot} index={i} />
          ))}

          {/* Closing card: the pitch */}
          <div className="flex min-h-[340px] w-[70vw] max-w-[320px] shrink-0 items-center justify-center self-stretch rounded-3xl border border-line bg-bg-elev/50 p-8 backdrop-blur-md md:w-[360px] md:max-w-none">
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight md:text-3xl">
                Hoćeš ovakve <span className="text-accent">brojke</span>?
              </p>
              <div className="mt-7">
                <CTAButton href="#booking">Book a Call</CTAButton>
              </div>
            </div>
          </div>
          <div className="w-6 shrink-0 md:w-12" aria-hidden />
        </motion.div>

        {/* Progress line */}
        <div className="mx-6 mt-10 h-px bg-line md:mx-12 md:mt-14">
          <motion.div
            style={{ scaleX: lineScale }}
            className="h-full origin-left bg-accent"
          />
        </div>
      </div>
    </section>
  );
}

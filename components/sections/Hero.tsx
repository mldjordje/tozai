"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import CTAButton from "@/components/ui/CTAButton";
import { useIntroReleased } from "@/lib/intro";

const EXPO = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.28 } },
};

const line = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.95, ease: EXPO },
  },
};

// The headline resolves out of focus as its words rise, and the two run at
// different rates so the line is still sharpening after the last word has
// landed — a reveal that finishes all at once reads as a state change rather
// than as movement.
//
// One blur animation on the h1 — never one per word — because a filter per
// element is a compositing layer per element, and this page already has a GPU
// budget to protect.
//
// staggerChildren belongs on THIS transition. Without it the words inherit
// nothing but the parent's own timing and every one of them rises in unison,
// which is what made the headline arrive as a single lump.
const headFocus = {
  hidden: { filter: "blur(18px)", opacity: 0, y: 12 },
  show: {
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.6,
      ease: EXPO,
      staggerChildren: 0.085,
      delayChildren: 0.1,
    },
  },
};

// Words rise inside an overflow mask. No rotation: a rotated word inside a mask
// cut to its own bounds throws its far corners past the clip, and the ends of
// the longer words were visibly sliced on the way in.
const headWord = {
  hidden: { y: "118%" },
  show: {
    y: "0%",
    transition: { duration: 1.15, ease: EXPO },
  },
};

const rule = {
  hidden: { scaleX: 0, opacity: 0 },
  show: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 1.5, ease: EXPO },
  },
};

// Word wrapped in an overflow mask so it rises out of a clean edge. The
// promotion is dropped once the reveal is over — a permanent will-change keeps
// a layer alive behind every word for the whole page.
function Word({
  children,
  settled,
}: {
  children: React.ReactNode;
  settled: boolean;
}) {
  return (
    <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        variants={headWord}
        className="inline-block"
        style={{ willChange: settled ? "auto" : "transform" }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  // The preloader sits over the first ~2s of the page. Animating on mount meant
  // the whole reveal played behind an opaque panel and the headline was already
  // set when the panel parted.
  const released = useIntroReleased();
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const show = reduce || released;

  return (
    // A short pin, not a full one: the hero holds just long enough for the
    // latent core to settle and be read before it starts dissolving into the
    // next formation. Any longer and the first scroll feels like it broke.
    <section id="top" className="relative h-[145svh]">
      <div className="sticky top-0 flex min-h-svh flex-col justify-center overflow-hidden px-6 md:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-bg via-bg/90 to-bg/55 md:hidden"
        />

        <motion.div
          variants={container}
          initial="hidden"
          animate={show ? "show" : "hidden"}
          className="relative z-10 max-w-4xl"
        >
          <motion.p variants={line} className="eyebrow mb-7">
            AI Video Studio
          </motion.p>

          {/* The words are spaced with margins, not whitespace text nodes, so
              the accessible name has to be supplied explicitly — otherwise
              assistive tech and copy-paste both read "BuildYourBusiness
              WithAI." */}
          <motion.h1
            variants={headFocus}
            onAnimationComplete={(def) => def === "show" && setSettled(true)}
            aria-label="Build Your Business With AI."
            style={{ willChange: settled ? "auto" : "filter" }}
            className="display text-balance text-6xl md:text-8xl lg:text-[6.5rem]"
          >
            <span aria-hidden className="mr-[0.24em]">
              <Word settled={settled}>Build</Word>
            </span>
            <span aria-hidden className="mr-[0.24em]">
              <Word settled={settled}>Your</Word>
            </span>
            <span aria-hidden>
              <Word settled={settled}>Business</Word>
            </span>
            <br />
            <span aria-hidden className="mr-[0.24em]">
              <Word settled={settled}>With</Word>
            </span>
            <span aria-hidden>
              <Word settled={settled}>
                {/* The sheen goes on a span INSIDE the em, not on the em
                    itself: `.display em` sets the accent colour at higher
                    specificity than `.sheen` can, so a clip applied to the em
                    would be overridden and the gradient would never show.
                    Last word of the headline, so the sweep — and the bloom
                    riding with it — wait for the whole line to arrive rather
                    than racing it. */}
                <em>
                  <span
                    className={show ? "sheen sheen-run" : "sheen"}
                    style={{ animationDelay: "1.15s" }}
                  >
                    AI
                  </span>
                </em>
                .
              </Word>
            </span>
          </motion.h1>

          {/* Hairline drawn under the headline once it has set. Pure scaleX on
              one element — the cheapest beat on the page and the one that makes
              the reveal land instead of just stopping. */}
          <motion.div
            aria-hidden
            variants={rule}
            className="mt-9 h-px w-full max-w-md origin-left bg-gradient-to-r from-accent-soft/70 via-line to-transparent"
          />

          <motion.div
            variants={line}
            className="mt-8 space-y-1 text-xl font-medium md:text-2xl"
          >
            <p>Ne učimo AI. Gradimo biznise uz AI.</p>
            <p className="text-muted">Pametnije. Brže. Profitabilnije.</p>
          </motion.div>

          <motion.p
            variants={line}
            className="mt-8 max-w-xl text-base leading-relaxed text-muted md:text-lg"
          >
            Kreiramo AI video reklame i pružamo privatnu AI edukaciju — sadržaj
            koji zaustavlja skrol i uči te da ga praviš sam.
          </motion.p>

          <motion.div variants={line} className="mt-10 flex flex-wrap gap-4">
            <CTAButton href="#booking">Book a Call</CTAButton>
            <CTAButton href="#services" variant="ghost">
              Explore Services
            </CTAButton>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          transition={{ delay: show ? 1.6 : 0, duration: 1 }}
          className="absolute bottom-8 left-6 z-10 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-faint md:left-12"
        >
          <span className="relative flex h-9 w-5 items-start justify-center rounded-full border border-faint p-1">
            <motion.span
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
          </span>
          Skroluj
        </motion.div>
      </div>
    </section>
  );
}

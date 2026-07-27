"use client";

import { motion } from "framer-motion";
import CTAButton from "@/components/ui/CTAButton";
import { PhoenixMark } from "@/components/brand/Logo";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.25 } },
};

const line = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.95, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const headWord = {
  hidden: { y: "115%", rotate: 4 },
  show: {
    y: "0%",
    rotate: 0,
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// The headline resolves out of focus as its words rise. One blur animation on
// the h1 — never one per word — because a filter per element is a compositing
// layer per element, and this page already has a GPU budget to protect.
const headFocus = {
  hidden: { filter: "blur(16px)", opacity: 0.4 },
  show: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: 1.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// Word wrapped in an overflow mask so it rises out of a clean edge.
function Word({ children }: { children: React.ReactNode }) {
  return (
    <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span variants={headWord} className="inline-block will-change-transform">
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
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
          aria-hidden
          initial={{ opacity: 0, x: 28, scale: 0.96 }}
          animate={{ opacity: 0.58, x: 0, scale: 1 }}
          transition={{ duration: 1.4, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute right-[8vw] top-1/2 hidden w-[min(29vw,24rem)] -translate-y-1/2 text-bg lg:block"
        >
          <PhoenixMark className="h-auto w-full" />
        </motion.div>

        <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-4xl"
      >
        <motion.p variants={line} className="eyebrow mb-7">
          AI Video Studio
        </motion.p>

        {/* The words are spaced with margins, not whitespace text nodes, so the
            accessible name has to be supplied explicitly — otherwise assistive
            tech and copy-paste both read "BuildYourBusiness WithAI." */}
        <motion.h1
          variants={headFocus}
          aria-label="Build Your Business With AI."
          className="display text-balance text-6xl md:text-8xl lg:text-[6.5rem]"
        >
          <span className="mr-[0.24em]">
            <Word>Build</Word>
          </span>
          <span className="mr-[0.24em]">
            <Word>Your</Word>
          </span>
          <Word>Business</Word>
          <br />
          <span className="mr-[0.24em]">
            <Word>With</Word>
          </span>
          <Word>
            {/* The sheen goes on a span INSIDE the em, not on the em itself:
                `.display em` sets the accent colour at higher specificity than
                `.sheen` can, so a clip applied to the em would be overridden and
                the gradient would never show. Last word of the headline, so the
                sweep waits for the whole line to arrive rather than racing it. */}
            <em>
              <span className="sheen sheen-run" style={{ animationDelay: "1.35s" }}>
                AI
              </span>
            </em>
            .
          </Word>
        </motion.h1>

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
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
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

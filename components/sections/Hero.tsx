"use client";

import { motion } from "framer-motion";
import CTAButton from "@/components/ui/CTAButton";

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
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center px-6 md:px-12"
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative max-w-4xl"
      >
        <motion.p variants={line} className="eyebrow mb-7">
          AI Video Studio
        </motion.p>

        {/* The words are spaced with margins, not whitespace text nodes, so the
            accessible name has to be supplied explicitly — otherwise assistive
            tech and copy-paste both read "BuildYourBusiness WithAI." */}
        <h1
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
            <em>AI</em>.
          </Word>
        </h1>

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
        className="absolute bottom-8 left-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-faint md:left-12"
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
    </section>
  );
}

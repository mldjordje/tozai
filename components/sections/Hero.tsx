"use client";

import { motion } from "framer-motion";
import Magnetic from "@/components/ui/Magnetic";

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

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center px-6 md:px-12"
    >
      {/* Accent glow behind the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-1/3 h-[38rem] w-[38rem] rounded-full bg-accent/20 blur-[140px]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative max-w-4xl"
      >
        <motion.p
          variants={line}
          className="mb-6 flex items-center gap-3 text-sm font-medium uppercase tracking-[0.25em] text-accent-soft"
        >
          <span className="h-px w-8 bg-accent-soft/60" />
          AI Video Studio
        </motion.p>

        <motion.h1
          variants={line}
          className="text-balance text-5xl font-semibold leading-[1.0] tracking-tight md:text-7xl lg:text-[5.5rem]"
        >
          Build Your Business
          <br />
          With{" "}
          <span className="bg-gradient-to-r from-accent to-accent-soft bg-clip-text text-transparent">
            AI
          </span>
          .
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
          <Magnetic>
            <a
              href="#booking"
              className="group relative inline-block overflow-hidden rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white"
            >
              <span className="relative z-10">Book a Call</span>
              <span className="absolute inset-0 -translate-x-full bg-accent-soft transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0" />
            </a>
          </Magnetic>
          <Magnetic>
            <a
              href="#services"
              className="inline-block rounded-full border border-line bg-bg-elev/40 px-7 py-3.5 text-sm font-semibold text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft"
            >
              Explore Services
            </a>
          </Magnetic>
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

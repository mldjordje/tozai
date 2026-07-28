"use client";

import { Fragment, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import CTAButton from "@/components/ui/CTAButton";
import { useIntroReleased } from "@/lib/intro";
import { DEFAULTS } from "@/lib/content/landing";
import { plainText } from "@/components/ui/AccentText";

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

/** One word of the headline, split into what precedes the accent, the accent
 *  itself and what trails it — so "*AI*." keeps the full stop outside the
 *  italic, the way the hand-written markup had it. */
function parseWord(raw: string) {
  const match = raw.match(/^(.*?)\*(.+?)\*(.*)$/);
  if (!match) return { lead: raw, accent: null as string | null, trail: "" };
  return { lead: match[1], accent: match[2], trail: match[3] };
}

export default function Hero({
  // Both hero CTAs pointed at anchors that dead-ended: "Book a Call" landed on
  // a section whose own button scrolled back to the top, and "Explore Services"
  // landed on the stats block. They now open the two things that can actually
  // be bought. Defaults keep the component renderable without the DB.
  primaryHref = "#paketi",
  primaryLabel = DEFAULTS.hero_cta_primary,
  secondaryHref = "#edukacija",
  secondaryLabel = DEFAULTS.hero_cta_secondary,
  eyebrow = DEFAULTS.hero_eyebrow,
  title = DEFAULTS.hero_title,
  lead1 = DEFAULTS.hero_lead_1,
  lead2 = DEFAULTS.hero_lead_2,
  body = DEFAULTS.hero_body,
}: {
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Admin-editable copy — see lib/content/landing.ts. `title` splits on "\n"
   *  for the line break and marks the `*word*` as the sheened accent. */
  eyebrow?: string;
  title?: string;
  lead1?: string;
  lead2?: string;
  body?: string;
} = {}) {
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
            {eyebrow}
          </motion.p>

          {/* The words are spaced with margins, not whitespace text nodes, so
              the accessible name has to be supplied explicitly — otherwise
              assistive tech and copy-paste both read "BuildYourBusiness
              WithAI." */}
          <motion.h1
            variants={headFocus}
            onAnimationComplete={(def) => def === "show" && setSettled(true)}
            aria-label={plainText(title.replace(/\n/g, " "))}
            style={{ willChange: settled ? "auto" : "filter" }}
            className="display text-balance text-6xl md:text-8xl lg:text-[6.5rem]"
          >
            {title.split("\n").map((row, rowIndex, rows) => (
              <Fragment key={rowIndex}>
                {row.split(" ").filter(Boolean).map((raw, i, words) => {
                  const { lead, accent, trail } = parseWord(raw);
                  return (
                    <span
                      key={`${raw}-${i}`}
                      aria-hidden
                      className={i < words.length - 1 ? "mr-[0.24em]" : undefined}
                    >
                      <Word settled={settled}>
                        {lead}
                        {/* The sheen goes on a span INSIDE the em, not on the
                            em itself: `.display em` sets the accent colour at
                            higher specificity than `.sheen` can, so a clip
                            applied to the em would be overridden and the
                            gradient would never show. Delayed past the last
                            word's rise so the sweep — and the bloom riding
                            with it — waits for the line to arrive rather than
                            racing it. */}
                        {accent && (
                          <em>
                            <span
                              className={show ? "sheen sheen-run" : "sheen"}
                              style={{ animationDelay: "1.15s" }}
                            >
                              {accent}
                            </span>
                          </em>
                        )}
                        {trail}
                      </Word>
                    </span>
                  );
                })}
                {rowIndex < rows.length - 1 && <br />}
              </Fragment>
            ))}
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
            <p>{lead1}</p>
            <p className="text-muted">{lead2}</p>
          </motion.div>

          <motion.p
            variants={line}
            className="mt-8 max-w-xl text-base leading-relaxed text-muted md:text-lg"
          >
            {body}
          </motion.p>

          <motion.div variants={line} className="mt-10 flex flex-wrap gap-4">
            <CTAButton href={primaryHref}>{primaryLabel}</CTAButton>
            <CTAButton href={secondaryHref} variant="ghost">
              {secondaryLabel}
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

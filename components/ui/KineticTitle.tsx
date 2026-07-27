"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const EXPO = [0.16, 1, 0.3, 1] as const;

const STAGGER = 0.085;
const LEAD = 0.1;
const RISE = 1.15;

/**
 * Editorial headline reveal. Each WORD rises out of an overflow mask when the
 * title scrolls into view, staggered along the line.
 *
 * Per-CHARACTER masks were the previous approach and they were the bug: every
 * glyph became its own inline-block, which discards the kerning pairs and the
 * discretionary ligatures `.display` explicitly turns on, and the per-glyph
 * `skewY` threw each glyph's corners past a clip cut to that same glyph, so the
 * letters visibly sliced on the way in. Words are the right unit — the type
 * stays set the way the face intends it.
 *
 * Driven by useInView on the container rather than per-element whileInView,
 * which is unreliable inside a position:sticky ancestor (the pinned titles).
 *
 * Wrap a word in asterisks to set it as the italic accent: "Brojevi koji rade
 * *za sebe*." Every headline gets one, which is what makes the set read as a
 * family instead of six unrelated lines. The accent also takes a single slow
 * sheen and a bloom once the line has finished arriving.
 *
 * Three things move, at three different rates, which is what stops the reveal
 * reading as one CSS transition:
 *
 *   1. the whole line resolves out of focus and settles a few pixels — ONE blur
 *      animation on the container, never per word. A filter per element is an
 *      offscreen buffer per element, and on exactly the integrated GPUs this
 *      site already has to be careful with it turns a headline into a stutter.
 *   2. each word rises out of its mask, staggered along the line
 *   3. the accent word lands a beat late and then takes the sheen
 */
const word = {
  hidden: { y: "118%" },
  show: {
    y: "0%",
    transition: { duration: RISE, ease: EXPO },
  },
};

// The container's focus pull and settle. Longer than a single word's rise so
// the line is still sharpening after the last one has landed — a reveal that
// finishes all at once reads as a state change, not as a movement.
// `delay` rides in through `custom` rather than a `transition` prop: a
// transition prop on the component REPLACES the variant's own transition, which
// would take staggerChildren with it and drop the whole line at once.
const focus = {
  hidden: { filter: "blur(16px)", opacity: 0, y: 14 },
  show: (d: number) => ({
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.5,
      ease: EXPO,
      delay: d,
      staggerChildren: STAGGER,
      // Absolute offset from the parent's start, so the parent's own delay has
      // to be folded in here too.
      delayChildren: LEAD + d,
    },
  }),
};

export default function KineticTitle({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  /** Extra seconds before the line starts, for stacking two titles. */
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const [settled, setSettled] = useState(false);

  const words = text.split(" ");

  return (
    // Words are separated by margin, not whitespace, so the split-up spans are
    // hidden from assistive tech and the real string is given as the label.
    <motion.h2
      ref={ref}
      className={className}
      aria-label={text.replace(/\*/g, "")}
      variants={focus}
      custom={delay}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      onAnimationComplete={(def) => def === "show" && setSettled(true)}
      // Promoted for the duration of the blur only — a permanent will-change on
      // a filter keeps the layer alive for the whole page.
      style={{ willChange: settled ? "auto" : "filter" }}
    >
      {words.map((raw, i) => {
        // Any asterisk marks the word, not just a leading/trailing one: the
        // closing marker is usually followed by punctuation ("sebe*."), which
        // an endsWith check misses.
        const accent = raw.includes("*");
        const clean = raw.replace(/\*/g, "");

        // Wait out the stagger still to run before this word plus most of its
        // own rise, so the highlight crosses type that is already set.
        const sheenDelay = `${(delay + LEAD + i * STAGGER + RISE * 0.6).toFixed(2)}s`;

        return (
          <span
            key={`${raw}-${i}`}
            aria-hidden
            className={`mr-[0.22em] inline-block align-bottom ${
              accent ? "display-accent" : ""
            }`}
          >
            <span className="-mb-[0.16em] inline-block overflow-hidden pb-[0.16em] align-bottom">
              <motion.span
                variants={word}
                className="inline-block"
                style={{ willChange: settled ? "auto" : "transform" }}
              >
                {accent ? (
                  // The sheen is a gradient clipped to the glyphs, and a clip
                  // whose ANCESTORS are transformed is the topology that is
                  // reliable everywhere — so the rise stays on the wrapper and
                  // the clip sits inside it, never the other way round.
                  <span
                    className={inView ? "sheen sheen-run" : "sheen"}
                    style={{ animationDelay: sheenDelay }}
                  >
                    {clean}
                  </span>
                ) : (
                  clean
                )}
              </motion.span>
            </span>
          </span>
        );
      })}
    </motion.h2>
  );
}

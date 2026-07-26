"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Editorial headline reveal. Each CHARACTER rises out of an overflow mask when
 * the title scrolls into view, staggered across the whole line — per-word
 * reveals move too much mass at once and read as a slideshow rather than as
 * type being set.
 *
 * Words stay intact as inline-blocks so wrapping is normal. Driven by useInView
 * on the container rather than per-element whileInView, which is unreliable
 * inside a position:sticky ancestor (the pinned showcase title).
 *
 * Wrap a word in asterisks to set it as the italic accent: "Brojevi koji rade
 * *za sebe*." Every headline gets one, which is what makes the set read as a
 * family instead of six unrelated lines. The accent also takes a single slow
 * sheen once the line has finished arriving.
 *
 * Three things move, at three different rates, which is what stops the reveal
 * reading as one CSS transition:
 *
 *   1. the whole line resolves out of focus — ONE blur animation on the
 *      container, never per character. Thirty simultaneous filters is thirty
 *      offscreen buffers, and on exactly the integrated GPUs this site already
 *      has to be careful with it turns a headline into a stutter.
 *   2. each character rises out of its mask, staggered along the line
 *   3. each character un-skews as it lands, so the type settles rather than
 *      stopping dead
 */
const char = {
  hidden: { y: "118%", opacity: 0, skewY: 4 },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    skewY: 0,
    transition: {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1] as const,
      delay: i * 0.02,
    },
  }),
};

// The container's focus pull. Slightly longer than a single character's rise so
// the line is still sharpening after the last glyph has landed — a reveal that
// finishes all at once reads as a state change, not as a movement.
const focus = {
  hidden: { filter: "blur(14px)", opacity: 0.55 },
  show: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: 1.35, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function KineticTitle({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  const words = text.split(" ");
  // Character index has to run across the whole title, not restart per word,
  // or the stagger resets and the line arrives in clumps.
  let index = Math.round(delay * 18);

  return (
    // Words are separated by margin, not whitespace, so the split-up spans are
    // hidden from assistive tech and the real string is given as the label.
    <motion.h2
      ref={ref}
      className={className}
      aria-label={text.replace(/\*/g, "")}
      variants={focus}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      // Promoted for the duration of the blur only — a permanent will-change on
      // a filter keeps the layer alive for the whole page.
      style={{ willChange: inView ? "auto" : "filter" }}
    >
      {words.map((word, wordIndex) => {
        // Any asterisk marks the word, not just a leading/trailing one: the
        // closing marker is usually followed by punctuation ("sebe*."), which
        // an endsWith check misses.
        const accent = word.includes("*");
        const clean = word.replace(/\*/g, "");

        // The accent word rises as ONE unit rather than character by character.
        // Two reasons, and only the second is aesthetic:
        //
        //   1. the sheen is a gradient clipped to the glyphs, and a clip whose
        //      DESCENDANTS are transformed is fragile — putting the transform on
        //      an ancestor of the clipped span instead is the topology that is
        //      reliable everywhere.
        //   2. the marked word is the emphasis of the line. Landing it whole,
        //      a beat behind the letters around it, is what emphasis looks like.
        if (accent) {
          // Wait out the stagger still to run before this word, plus the rise
          // itself, so the highlight crosses type that is already set.
          const sheenDelay = `${(index * 0.02 + 0.85).toFixed(2)}s`;
          const wordIn = index * 0.02;
          index += clean.length;
          return (
            <span
              key={`${word}-${wordIndex}`}
              aria-hidden
              className="display-accent mr-[0.22em] inline-block align-bottom"
            >
              <span className="-mb-[0.16em] inline-block overflow-hidden pb-[0.16em] align-bottom">
                <motion.span
                  className="inline-block will-change-transform"
                  custom={wordIn / 0.02}
                  variants={char}
                  initial="hidden"
                  animate={inView ? "show" : "hidden"}
                >
                  <span
                    className={`sheen ${inView ? "sheen-run" : ""}`}
                    style={{ animationDelay: sheenDelay }}
                  >
                    {clean}
                  </span>
                </motion.span>
              </span>
            </span>
          );
        }

        return (
          <span
            key={`${word}-${wordIndex}`}
            aria-hidden
            className="mr-[0.22em] inline-block align-bottom"
          >
            {Array.from(clean).map((glyph, glyphIndex) => (
              <span
                key={glyphIndex}
                className="-mb-[0.16em] inline-block overflow-hidden pb-[0.16em] align-bottom"
              >
                <motion.span
                  className="inline-block will-change-transform"
                  custom={index++}
                  variants={char}
                  initial="hidden"
                  animate={inView ? "show" : "hidden"}
                >
                  {glyph}
                </motion.span>
              </span>
            ))}
          </span>
        );
      })}
    </motion.h2>
  );
}

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
 * family instead of six unrelated lines.
 */
const char = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1] as const,
      delay: i * 0.016,
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
    <h2 ref={ref} className={className} aria-label={text.replace(/\*/g, "")}>
      {words.map((word, wordIndex) => {
        // Any asterisk marks the word, not just a leading/trailing one: the
        // closing marker is usually followed by punctuation ("sebe*."), which
        // an endsWith check misses.
        const accent = word.includes("*");
        const clean = word.replace(/\*/g, "");
        return (
          <span
            key={`${word}-${wordIndex}`}
            aria-hidden
            className={`mr-[0.22em] inline-block align-bottom ${accent ? "display-accent" : ""}`}
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
    </h2>
  );
}

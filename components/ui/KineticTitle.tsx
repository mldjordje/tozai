"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Word-by-word kinetic reveal: each word rises out of an overflow mask with
 * a slight rotation when the title scrolls into view. Driven by useInView on
 * the container rather than per-word whileInView, which is unreliable inside
 * a position:sticky ancestor (the pinned showcase title).
 */
const word = {
  hidden: { y: "115%", rotate: 5, opacity: 0 },
  show: (i: number) => ({
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const, delay: i * 0.055 },
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

  return (
    <h2 ref={ref} className={className}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="-mb-[0.14em] mr-[0.24em] inline-block overflow-hidden pb-[0.14em] align-bottom"
        >
          <motion.span
            className="inline-block will-change-transform"
            custom={i + delay * 18}
            variants={word}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </h2>
  );
}

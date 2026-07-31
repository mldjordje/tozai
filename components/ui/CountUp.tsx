"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

/**
 * Animated stat: counts from 0 to the numeric prefix when scrolled into
 * view, keeping any suffix ("M+", "K", "+") static. "16M+" -> 0..16 + "M+".
 *
 * A value is only counted when its leading number is the whole quantity — a
 * digit anywhere in the suffix means the string is not one. "1-na-1" would
 * otherwise be read as the number 1 followed by the text "-na-1", and the rail
 * would render "0-na-1" until the animation ran and reached the same number it
 * started from. Those values are printed as written.
 */
export default function CountUp({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const parsed = value.match(/^([\d.,]+)(.*)$/);
  const match = parsed && !/\d/.test(parsed[2]) ? parsed : null;
  const target = match ? parseFloat(match[1].replace(",", ".")) : 0;
  const suffix = match ? match[2] : value;
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [shown, setShown] = useState(match ? "0" : value);

  useEffect(() => {
    if (!inView || !match) return;
    const controls = animate(0, target, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v).toString()),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target]);

  return (
    <span ref={ref} className={className}>
      {shown}
      {match ? suffix : ""}
    </span>
  );
}

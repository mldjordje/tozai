"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Magnetic hover: the wrapped element leans toward the cursor while it's
 * inside, then springs back on leave. Wrap CTAs and nav buttons.
 */
export default function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 190, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 190, damping: 16, mass: 0.4 });

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ x: sx, y: sy }}
      className={className ?? "inline-block"}
    >
      {children}
    </motion.div>
  );
}

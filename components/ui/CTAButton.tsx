"use client";

import type { ReactNode } from "react";

/**
 * Landing CTA. One idea only: the arrow swings from -45° to 0° on hover.
 * No magnetic pull, no shine sweep — those read as effects stacked on a
 * button rather than as craft.
 */
export default function CTAButton({
  href,
  children,
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
}) {
  const sizing =
    size === "lg"
      ? "px-9 py-[1.1rem] text-base"
      : "px-7 py-3.5 text-sm";
  const skin =
    variant === "primary"
      ? "bg-fg text-bg transition-colors duration-300 hover:bg-white"
      : "border border-line bg-bg-elev/40 text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft";

  return (
    <a
      href={href}
      className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full font-medium ${sizing} ${skin}`}
    >
      <span className="relative z-10">{children}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10 h-4 w-4 -rotate-45 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:rotate-0"
        aria-hidden
      >
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BrandLogo from "@/components/brand/Logo";

// "Usluge" used to point at #services, which is the stats block — the buyer got
// numbers when they asked for offerings. The section ids stay as they are
// (LatentBackground times its formations off them); the menu points at what the
// label promises instead.
// Hash links resolve against the landing, so they are written with a leading
// "/" — the same header renders on /portfolio, where a bare "#paketi" would
// scroll to nothing.
const LINKS = [
  { href: "/#portfolio", label: "Rezultati" },
  { href: "/portfolio", label: "Radovi" },
  { href: "/#paketi", label: "Paketi" },
  { href: "/#edukacija", label: "Edukacija" },
  { href: "/#booking", label: "Kontakt" },
];

export default function Nav({
  ctaHref = "#paketi",
  ctaLabel = "Pošalji upit",
}: {
  /** Where the header CTA goes — the checkout brief for the featured package,
   *  resolved on the server from the packages table. */
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <a
          href="/#top"
          aria-label="TOZA AI — početna"
          className="text-lg text-fg"
        >
          <BrandLogo markClassName="size-8" />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors duration-300 hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {/* No session check here — /nalog is gated by middleware, which sends
              signed-out visitors to /prijava. Keeps the nav a static component. */}
          <a
            href="/nalog"
            className="hidden text-sm text-muted transition-colors duration-300 hover:text-fg sm:inline"
          >
            Nalog
          </a>
          <a
            href={ctaHref}
            className="inline-block rounded-full border border-line bg-bg-elev/40 px-5 py-2 text-sm font-medium text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft"
          >
            {ctaLabel}
          </a>

          {/* The section links were desktop-only, so on a phone — where most of
              this traffic lands — the header had no navigation at all. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="nav-mobile"
            aria-label={open ? "Zatvori meni" : "Otvori meni"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elev/40 text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden
            >
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 8h16" />
                  <path d="M4 16h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="nav-mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mx-6 overflow-hidden rounded-2xl border border-line bg-bg/95 p-2 backdrop-blur-xl md:hidden"
          >
            {[...LINKS, { href: "/nalog", label: "Moj nalog" }].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm text-muted transition-colors duration-200 hover:bg-bg-elev/60 hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

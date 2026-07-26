"use client";

import { motion } from "framer-motion";

const LINKS = [
  { href: "#services", label: "Usluge" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#paketi", label: "Paketi" },
  { href: "#edukacija", label: "Edukacija" },
  { href: "#booking", label: "Kontakt" },
];

export default function Nav() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <a
          href="#top"
          className="text-lg font-semibold tracking-tight text-fg"
        >
          TOZ<span className="text-accent">AI</span>
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

        <div className="flex items-center gap-4">
          {/* No session check here — /nalog is gated by middleware, which sends
              signed-out visitors to /prijava. Keeps the nav a static component. */}
          <a
            href="/nalog"
            className="hidden text-sm text-muted transition-colors duration-300 hover:text-fg sm:inline"
          >
            Nalog
          </a>
          <a
            href="#booking"
            className="inline-block rounded-full border border-line bg-bg-elev/40 px-5 py-2 text-sm font-medium text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft"
          >
            Book a Call
          </a>
        </div>
      </nav>
    </motion.header>
  );
}

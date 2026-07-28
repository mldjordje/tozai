"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import BrandLogo from "@/components/brand/Logo";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

// "Usluge" used to point at #services, which is the stats block — the buyer got
// numbers when they asked for offerings. The section ids stay as they are
// (LatentBackground times its formations off them); the menu points at what the
// label promises instead.
// Hash links resolve against the landing, so they are written with a leading
// "/" — the same header renders on /portfolio, where a bare "#paketi" would
// scroll to nothing — and go through localePath so the English header stays on
// the English pages.

export default function Nav({
  locale = DEFAULT_LOCALE,
  ctaHref = "#paketi",
  ctaLabel,
}: {
  locale?: Locale;
  /** Where the header CTA goes — the general brief, resolved on the server. */
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = ui(locale);
  const links = t.nav.links.map((link) => ({
    ...link,
    href: localePath(locale, link.href),
  }));

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <a
          href={localePath(locale, "/#top")}
          aria-label={t.nav.home}
          className="text-lg text-fg"
        >
          <BrandLogo markClassName="size-8" />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
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
          <LanguageSwitch locale={locale} label={t.nav.language} />

          {/* No session check here — /nalog is gated by middleware, which sends
              signed-out visitors to /prijava. Keeps the nav a static component. */}
          <a
            href="/nalog"
            className="hidden text-sm text-muted transition-colors duration-300 hover:text-fg sm:inline"
          >
            {t.nav.account}
          </a>
          <a
            href={ctaHref}
            className="inline-block rounded-full border border-line bg-bg-elev/40 px-5 py-2 text-sm font-medium text-fg backdrop-blur-md transition-colors duration-300 hover:border-accent-soft"
          >
            {ctaLabel ?? t.nav.cta}
          </a>

          {/* The section links were desktop-only, so on a phone — where most of
              this traffic lands — the header had no navigation at all. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="nav-mobile"
            aria-label={open ? t.nav.close : t.nav.menu}
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
            <div className="px-3 pb-2 pt-1">
              <LanguageSwitch locale={locale} label={t.nav.language} mobile />
            </div>
            {[...links, { href: "/nalog", label: t.nav.account }].map((l) => (
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

/**
 * SR / EN, as two links rather than a dropdown.
 *
 * The target is the page the visitor is already on, translated: /portfolio
 * becomes /en/portfolio and back. That is the whole reason this reads the
 * pathname instead of always pointing at the home page — a switch that dumps
 * someone back to the top of the site is a switch people stop using.
 *
 * Real links, not a client-side locale toggle, because the two languages are
 * two sets of URLs: the choice has to survive a refresh and be shareable.
 */
function LanguageSwitch({
  locale,
  label,
  mobile = false,
}: {
  locale: Locale;
  label: string;
  mobile?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  // Strip the prefix to get back to the Serbian form, then re-prefix as needed.
  const bare = pathname === "/en" ? "/" : pathname.startsWith("/en/") ? pathname.slice(3) : pathname;

  return (
    <div
      aria-label={label}
      className={`items-center rounded-full border border-line bg-bg-elev/40 p-0.5 text-xs backdrop-blur-md ${
        mobile ? "flex w-fit" : "hidden md:flex"
      }`}
    >
      {(["sr", "en"] as const).map((option) => {
        const active = option === locale;
        return (
          <a
            key={option}
            href={localePath(option, bare)}
            hrefLang={option}
            aria-current={active ? "true" : undefined}
            className={`rounded-full px-2.5 py-1 uppercase tracking-[0.12em] transition-colors duration-300 ${
              active ? "bg-fg text-bg" : "text-muted hover:text-fg"
            }`}
          >
            {option}
          </a>
        );
      })}
    </div>
  );
}

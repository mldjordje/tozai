import Link from "next/link";
import BrandLogo from "@/components/brand/Logo";
import { type PublicContact } from "@/lib/settings";
import SocialLinks from "@/components/ui/SocialLinks";
import { DEFAULTS } from "@/lib/content/landing";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

/**
 * The page used to end on a pinned CTA and nothing else: a buyer who scrolled
 * past it had no way to reach an offer, an account or a human without scrolling
 * back up. This is the floor of the funnel — every destination the site can
 * actually serve, in one place.
 *
 * Contact rows render only when the owner has filled them in /admin/podesavanja,
 * so the footer never shows an empty "Email:" label or a mailto: to nowhere.
 */
export default function Footer({
  locale = DEFAULT_LOCALE,
  contact,
  inquiryHref,
  tagline = DEFAULTS.footer_tagline,
  response = DEFAULTS.footer_response,
}: {
  locale?: Locale;
  contact: PublicContact;
  inquiryHref: string;
  tagline?: string;
  response?: string;
}) {
  const socials = contact.socials;
  const t = ui(locale);

  return (
    <footer className="relative z-10 border-t border-line bg-bg/80 px-6 py-16 backdrop-blur-md md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link
              href={localePath(locale, "/#top")}
              aria-label={t.nav.home}
              className="inline-block"
            >
              <BrandLogo markClassName="size-8" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">{tagline}</p>
          </div>

          <FooterCol
            title={t.footer.offer}
            links={[
              ...t.footer.offerLinks.map((link) => ({
                ...link,
                href: localePath(locale, link.href),
              })),
              { label: t.nav.cta, href: inquiryHref },
            ]}
          />

          {/* The account area is Serbian-only for now, so its links are left
              unprefixed rather than pointing at /en pages that do not exist. */}
          <FooterCol title={t.footer.account} links={t.footer.accountLinks} />

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-faint">
              {t.footer.contact}
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {contact.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-muted transition-colors duration-300 hover:text-fg"
                  >
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.phone && (
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                    className="text-muted transition-colors duration-300 hover:text-fg"
                  >
                    {contact.phone}
                  </a>
                </li>
              )}
              {/* Icons rather than a fourth column of text links: the studio
                  can now add as many profiles as it likes, and a growing list
                  of words would push the footer out of shape. */}
              {socials.length > 0 && (
                <li className="pt-1">
                  <SocialLinks links={socials} />
                </li>
              )}
              {!contact.email && !contact.phone && socials.length === 0 && (
                <li className="text-muted">
                  <Link
                    href={inquiryHref}
                    className="transition-colors duration-300 hover:text-fg"
                  >
                    {t.footer.writeUs}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-7 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} TOZA AI. {t.footer.rights}
          </p>
          {/* Reachable from every page: a policy nobody can find is not a
              published policy, and Google's OAuth review looks for these. */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {t.footer.legalLinks.map((link) => (
              <Link
                key={link.href}
                href={localePath(locale, link.href)}
                className="transition-colors duration-300 hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
            <span className="hidden sm:inline">{response}</span>
          </nav>
          <p className="sm:hidden">{response}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.2em] text-faint">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-muted transition-colors duration-300 hover:text-fg"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

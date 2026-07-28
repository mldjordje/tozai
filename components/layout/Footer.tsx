import Link from "next/link";
import BrandLogo from "@/components/brand/Logo";
import { socialUrl, type PublicContact } from "@/lib/settings";
import { DEFAULTS } from "@/lib/content/landing";

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
  contact,
  inquiryHref,
  tagline = DEFAULTS.footer_tagline,
  response = DEFAULTS.footer_response,
}: {
  contact: PublicContact;
  inquiryHref: string;
  tagline?: string;
  response?: string;
}) {
  const socials = [
    { label: "Instagram", href: socialUrl("https://instagram.com", contact.instagram) },
    { label: "TikTok", href: socialUrl("https://tiktok.com/@", contact.tiktok) },
    { label: "YouTube", href: socialUrl("https://youtube.com", contact.youtube) },
    { label: "LinkedIn", href: socialUrl("https://linkedin.com/in", contact.linkedin) },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <footer className="relative z-10 border-t border-line bg-bg/80 px-6 py-16 backdrop-blur-md md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/#top" aria-label="TOZA AI — početna" className="inline-block">
              <BrandLogo markClassName="size-8" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">{tagline}</p>
          </div>

          <FooterCol
            title="Ponuda"
            links={[
              { label: "AI video paketi", href: "/#paketi" },
              { label: "Privatna edukacija", href: "/#edukacija" },
              { label: "Rezultati", href: "/#portfolio" },
              { label: "Pošalji upit", href: inquiryHref },
            ]}
          />

          <FooterCol
            title="Nalog"
            links={[
              { label: "Moj nalog", href: "/nalog" },
              { label: "Moji upiti", href: "/nalog/zahtevi" },
              { label: "Porudžbine", href: "/nalog/porudzbine" },
              { label: "Prijava", href: "/prijava" },
            ]}
          />

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-faint">Kontakt</h3>
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
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted transition-colors duration-300 hover:text-fg"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
              {!contact.email && !contact.phone && socials.length === 0 && (
                <li className="text-muted">
                  <Link
                    href={inquiryHref}
                    className="transition-colors duration-300 hover:text-fg"
                  >
                    Piši nam kroz upit →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-7 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TOZA AI. Sva prava zadržana.</p>
          <p>{response}</p>
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

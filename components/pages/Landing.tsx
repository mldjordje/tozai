import LatentBackground from "@/components/background/LatentBackground";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PinnedSection from "@/components/layout/PinnedSection";
import Preloader from "@/components/ui/Preloader";
import Reveal from "@/components/ui/Reveal";
import KineticTitle from "@/components/ui/KineticTitle";
import CountUp from "@/components/ui/CountUp";
import CTAButton from "@/components/ui/CTAButton";
import TextStrip from "@/components/ui/TextStrip";
import SocialLinks from "@/components/ui/SocialLinks";
import GoogleReviews from "@/components/ui/GoogleReviews";
import Hero from "@/components/sections/Hero";
import ResultsShowcase from "@/components/sections/ResultsShowcase";
import Packages from "@/components/sections/Packages";
import Education from "@/components/sections/Education";
import Faq from "@/components/sections/Faq";
import { getPublicPackages, type Package } from "@/lib/packages";
import { getLegalIdentity, getPublicContact, type LegalIdentity } from "@/lib/settings";
import { toClipPackage, toHourPack } from "@/lib/content/offerings";
import { getLandingContent } from "@/lib/content/landing.server";
import { getPublicResultShots } from "@/lib/results";
import { getPublicFaq, type FaqItem } from "@/lib/faq";
import { localePath, type Locale } from "@/lib/i18n/config";
import { normalizeSocialUrl } from "@/lib/socials";

// The home page, rendered once per language.
//
// Both routes ("/" for Serbian, "/en" for English) render this with a locale,
// and every read below is given that locale so the copy, the packages and the
// proof rail come back in one language. Links go through localePath() rather
// than being written out, so a section anchor on the English page stays on the
// English page.

function checkoutHref(locale: Locale, pkg: Package | undefined, fallback: string): string {
  return pkg?.slug ? localePath(locale, `/porudzbina/${pkg.slug}`) : fallback;
}

function pickFeatured(items: Package[]): Package | undefined {
  return items.find((item) => item.highlighted) ?? items[0];
}

/** Desktop column count for the numbers rail, so the row stays full instead of
 *  ending in empty columns — the studio can keep between one and eight stats in
 *  /admin/sadrzaj, and four of them was only ever the shipped default. Written
 *  as whole class names because Tailwind reads the source, not the runtime. */
function statColumns(count: number): string {
  if (count <= 2) return "md:grid-cols-2";
  if (count === 3 || count === 6) return "md:grid-cols-3";
  return "md:grid-cols-4";
}

/** Social profile URLs, absolute and stripped of share-sheet tracking. A URL
 *  the parser rejects is dropped rather than emitted broken. */
function canonicalProfiles(socials: { url: string }[]): string[] {
  return socials
    .map((social) => {
      try {
        const url = new URL(normalizeSocialUrl(social.url));
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      } catch {
        return null;
      }
    })
    .filter((url): url is string => url !== null);
}

/**
 * Who runs this site, in the form a machine reads.
 *
 * The footer already prints the registration details for people. This says the
 * same thing to the crawlers that score a shared link — the studio's Instagram
 * was restricted under "fraud, scams and deceptive practices" while the only
 * evidence of a real business sat in prose on /uslovi. A structured
 * Organization node with a legal name, a street address and a tax number is
 * cheap to emit and is the thing an automated reviewer can actually verify.
 *
 * Emitted only when the studio has filled the fields in; a schema.org node
 * full of nulls is worse than none. The email is left out on purpose while
 * SHOW_PUBLIC_EMAIL is off (lib/settings.ts).
 */
function organizationSchema(identity: LegalIdentity, socials: string[]): string | null {
  if (!identity.companyName) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TOZA AI",
    legalName: identity.companyName,
    url: "https://toza-ai.rs",
    ...(identity.pib ? { taxID: identity.pib, vatID: `RS${identity.pib}` } : {}),
    ...(identity.mb ? { identifier: identity.mb } : {}),
    ...(identity.phone ? { telephone: identity.phone } : {}),
    ...(identity.address || identity.city
      ? {
          address: {
            "@type": "PostalAddress",
            ...(identity.address ? { streetAddress: identity.address } : {}),
            ...(identity.city ? { addressLocality: identity.city } : {}),
            addressCountry: "RS",
          },
        }
      : {}),
    ...(socials.length ? { sameAs: socials } : {}),
  });
}

/**
 * The same questions the page renders, in the shape an AI answer engine or a
 * search result actually reads. Google's FAQ rich result and every LLM crawler
 * that has picked up FAQPage as a citation source both key off this — it is the
 * cheapest, most direct SEO/AI-answer lever a site this size has, and it costs
 * nothing beyond emitting what is already on the page as structured data.
 *
 * Emitted only when there is at least one question, same reasoning as
 * organizationSchema: a schema.org node with an empty mainEntity is worse than
 * none.
 */
function faqSchema(items: FaqItem[]): string | null {
  if (items.length === 0) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  });
}

export default async function Landing({ locale }: { locale: Locale }) {
  const [services, education, razvoj, faq, contact, copy, shots, identity] = await Promise.all([
    getPublicPackages("services", locale),
    getPublicPackages("education", locale),
    getPublicPackages("razvoj", locale),
    getPublicFaq(locale),
    getPublicContact(),
    getLandingContent(locale),
    getPublicResultShots(locale),
    getLegalIdentity(),
  ]);
  // Normalised, because sameAs has to be absolute: a scheme-less profile URL
  // would resolve against our own origin and point the crawler at a 404. The
  // query string goes too — these are pasted out of the apps' share sheets and
  // arrive carrying igsh/utm tracking, which makes the profile harder for a
  // crawler to match against the one it already knows.
  const orgSchema = organizationSchema(identity, canonicalProfiles(contact.socials));
  const faqSchemaJson = faqSchema(faq);
  const projects = services.filter((item) => item.flow === "project");
  // Wrapped rather than passed by reference: map's second argument is the
  // index, which would arrive where the mapper expects the locale.
  const clipPackages = projects.map((item) => toClipPackage(item, locale));
  // The web / app / automation rail. No static fallback on purpose: unlike the
  // video packages there is nothing to mirror offline, so an empty table means
  // the studio has not added these yet and the section stays off the page
  // rather than rendering cards whose buttons go nowhere.
  const buildPackages = razvoj
    .filter((item) => item.flow === "build")
    .map((item) => toClipPackage(item, locale));
  const serviceHours = services.filter((item) => item.flow === "hours");
  const hourPacks = [...education, ...serviceHours].map((item) => toHourPack(item, locale));

  // The free brief — the funnel's real entry point, and what "Book a Call"
  // was gesturing at without linking to.
  //
  // Fixed, not derived: these buttons say "Pošalji upit", not the name of a
  // service, so pointing them at whichever package happened to be featured
  // opened a brief for something the buyer never asked for. /upit opens the
  // same form with nothing ticked and the service picker first.
  const inquiryHref = localePath(locale, "/upit");
  // A paid 1-on-1 hour, if the studio sells one. There is no calendar yet, so
  // this buys the hour and the term is agreed from the account.
  const consultPkg = pickFeatured(serviceHours) ?? pickFeatured(education);
  const consultHref = checkoutHref(locale, consultPkg, "#edukacija");
  const consultLabel = consultPkg
    ? locale === "en"
      ? "Buy 1-on-1 hours"
      : "Kupi sate 1-na-1"
    : locale === "en"
      ? "Private education"
      : "Privatna edukacija";

  return (
    <>
      {orgSchema && (
        <script
          type="application/ld+json"
          // Server-rendered from our own database, never from user input.
          dangerouslySetInnerHTML={{ __html: orgSchema }}
        />
      )}
      {faqSchemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqSchemaJson }}
        />
      )}
      <Preloader />
      <LatentBackground />
      <Nav locale={locale} ctaHref={inquiryHref} ctaLabel={copy.results_cta} />

      <main className="relative">
        <Hero
          locale={locale}
          primaryHref={inquiryHref}
          primaryLabel={copy.hero_cta_primary}
          secondaryHref="#paketi"
          secondaryLabel={copy.hero_cta_secondary}
          tertiaryHref={consultPkg ? consultHref : undefined}
          tertiaryLabel={consultPkg ? consultLabel : undefined}
          eyebrow={copy.hero_eyebrow}
          title={copy.hero_title}
          lead1={copy.hero_lead_1}
          lead2={copy.hero_lead_2}
          body={copy.hero_body}
        />

        {/* Brojevi */}
        <PinnedSection id="services">
          <div className="w-full max-w-6xl">
            <p className="eyebrow mb-5">{copy.stats_eyebrow}</p>
            <KineticTitle
              text={copy.stats_title}
              className="display mb-16 max-w-2xl text-4xl md:mb-24 md:text-7xl"
            />
            <div className={`grid grid-cols-2 gap-x-8 gap-y-14 ${statColumns(copy.stats.length)}`}>
              {copy.stats.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.09}>
                  <CountUp
                    value={s.value}
                    className="text-5xl font-semibold tracking-tighter tabular-nums md:text-7xl"
                  />
                  <div className="mt-3 border-t border-line pt-3 text-sm text-muted md:text-base">
                    {s.label}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </PinnedSection>

        <TextStrip items={copy.strip_items} />

        {/* Proof — horizontal showcase: swipeable on touch, scroll-driven while
            pinned on desktop, every card opening full-size */}
        <ResultsShowcase
          locale={locale}
          ctaHref={inquiryHref}
          shots={shots.length ? shots : undefined}
          eyebrow={copy.results_eyebrow}
          title={copy.results_title}
          body={copy.results_body}
          cardTitle={copy.results_card_title}
          ctaLabel={copy.results_cta}
        />

        {/* Paketi — buy AI clips (admin-driven, static fallback) */}
        <Packages
          locale={locale}
          packages={clipPackages.length ? clipPackages : undefined}
          eyebrow={copy.packages_eyebrow}
          title={copy.packages_title}
          body={copy.packages_body}
          note={copy.packages_note}
        />

        {/* Web & Aplikacije — quoted per brief, delivered by the partner team.
            Rendered only when the studio has actually added the packages, and
            its copy is fixed rather than admin-driven: there is one paragraph
            of it and site_content is already the longest table in the panel.

            COPY RULE — same one that governs lib/content/offerings.ts. No
            outcome promises, no numbers that cannot be shown, no other
            company's brand named. */}
        {buildPackages.length > 0 && (
          <Packages
            locale={locale}
            id="razvoj"
            packages={buildPackages}
            eyebrow={locale === "en" ? "WEB & APPS" : "WEB & APLIKACIJE"}
            title={
              locale === "en"
                ? "Sites, apps, automation."
                : "Sajt, aplikacija, automatizacija."
            }
            body={
              locale === "en"
                ? "Describe what you need and we come back with a price and a timeline."
                : "Opiši šta ti treba i javljamo se sa procenom cene i roka."
            }
            note={
              locale === "en"
                ? "Every project is quoted from its own brief — scope, integrations and timeline all move the number, so there is no list price."
                : "Svaki projekat se procenjuje iz sopstvenog upita — obim, integracije i rok menjaju cenu, zato nema fiksnog cenovnika."
            }
          />
        )}

        {/* Edukacija — buy 1-on-1 hour packs (admin-driven, static fallback) */}
        <Education
          locale={locale}
          packs={hourPacks.length ? hourPacks : undefined}
          eyebrow={copy.education_eyebrow}
          title={copy.education_title}
          body={copy.education_body}
          pills={copy.education_pills}
        />

        {/* FAQ — admin-driven (the `faq` table, /admin/faq). No static fallback:
            unlike the pricing rails there is nothing to mirror offline, and an
            empty section reads worse than no section. */}
        <Faq
          locale={locale}
          items={faq}
          eyebrow={locale === "en" ? "04 — FAQ" : "04 — Pitanja"}
          title={locale === "en" ? "Questions, answered." : "Pitanja i odgovori."}
        />

        {/* Booking */}
        <PinnedSection id="booking" hold={0.7} className="justify-center text-center">
          <div>
            <Reveal>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg-elev/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {copy.booking_badge}
              </p>
            </Reveal>
            <KineticTitle
              text={copy.booking_title}
              className="display mx-auto max-w-4xl text-5xl md:text-8xl"
            />
            <Reveal delay={0.25}>
              {/* This was a "Book a Call" that scrolled back to #top — the last
                  thing a convinced buyer saw was a button that undid their
                  scroll. Both options now open a checkout they can finish. */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <CTAButton href={inquiryHref} size="lg">
                  {copy.booking_cta_primary}
                </CTAButton>
                <CTAButton href={consultHref} variant="ghost" size="lg">
                  {consultLabel}
                </CTAButton>
              </div>
            </Reveal>
            <Reveal delay={0.35}>
              <p className="mt-7 text-sm text-faint">
                {copy.booking_note}
                {contact.email && (
                  <>
                    {" "}
                    {locale === "en" ? "Or write straight to" : "Ili piši direktno na"}{" "}
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-muted underline underline-offset-4 transition-colors duration-300 hover:text-fg"
                    >
                      {contact.email}
                    </a>
                    .
                  </>
                )}
              </p>
              {/* The one place on the page where a visitor is already looking
                  for a way to reach the studio — and the proof rail above has
                  just spent six cards talking about these very accounts.
                  The Google profile sits with them: it is the one piece of
                  proof that is not ours to edit. */}
              <div className="mt-7 flex flex-col items-center gap-5">
                <SocialLinks links={contact.socials} className="justify-center" />
                <GoogleReviews locale={locale} mode="read" />
              </div>
            </Reveal>
          </div>
        </PinnedSection>
      </main>

      <Footer
        locale={locale}
        contact={contact}
        inquiryHref={inquiryHref}
        tagline={copy.footer_tagline}
        response={copy.footer_response}
      />
    </>
  );
}

/** Shared by both language routes, so each one declares the other as its
 *  alternate and search engines index them as one page in two languages.
 *
 *  The link-preview image is no longer named here. It comes from the
 *  opengraph-image file convention (app/opengraph-image.tsx and its English
 *  counterpart), which Next fills in for both og: and twitter: — see that file
 *  for why a follower-count screenshot should not be the picture on a shared
 *  link. Naming `images` here would override it. */
export function landingMetadata(locale: Locale) {
  // The title and the description are the two lines a link crawler reads when
  // the page is shared on Meta or TikTok, usually the only ones. Both describe
  // the service, name the registered entity behind it, and promise nothing
  // about the buyer's revenue — see the COPY RULE in lib/content/landing.ts.
  //
  // Set here and not left to app/layout.tsx: a page-level `title` replaces the
  // layout's outright, so the layout's value never reaches "/" or "/en". The
  // The headline on the page itself follows the same deliverable-first rule.
  const title =
    locale === "en"
      ? "TOZA AI — AI video production and AI education"
      : "TOZA AI — AI video produkcija i AI edukacija";
  const description =
    locale === "en"
      ? "AI video production and private 1-on-1 AI training. A registered studio in Niš, Serbia. Sending a brief is free and commits you to nothing."
      : "AI video produkcija i privatna 1-na-1 AI edukacija. Registrovan studio iz Niša. Upit je besplatan i ne obavezuje te na kupovinu.";
  return {
    title,
    description,
    alternates: {
      canonical: localePath(locale, "/"),
      languages: { sr: "/", en: "/en" },
    },
    // Declared on both: WhatsApp/Viber/Messenger read og:image, X reads
    // twitter:image, and "summary_large_image" is what makes it render as a
    // banner instead of a thumbnail beside the text.
    // `type` and `locale` are repeated from app/layout.tsx on purpose: Next
    // replaces the parent's openGraph object wholesale rather than merging into
    // it, so anything omitted here is simply dropped from the page.
    openGraph: {
      title,
      description,
      url: localePath(locale, "/"),
      type: "website" as const,
      locale: locale === "en" ? "en_US" : "sr_RS",
    },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}

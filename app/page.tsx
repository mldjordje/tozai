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
import Hero from "@/components/sections/Hero";
import ResultsShowcase from "@/components/sections/ResultsShowcase";
import Packages from "@/components/sections/Packages";
import Education from "@/components/sections/Education";
import { getPublicPackages, type Package } from "@/lib/packages";
import { getPublicContact } from "@/lib/settings";
import { toClipPackage, toHourPack } from "@/lib/content/offerings";
import { getLandingContent } from "@/lib/content/landing.server";
import { getPublicResultShots } from "@/lib/results";

// Pricing AND copy are admin-driven (packages + site_content tables). ISR keeps
// the landing fast; the admin write routes revalidatePath("/") so edits go live
// within a click.
export const revalidate = 60;

// Every CTA on this page has to land on something a buyer can complete. The
// destinations are derived from the packages table rather than hard-coded, so a
// renamed or retired package moves the buttons with it instead of leaving a
// 404. When the DB is unreachable the helpers return [] and everything falls
// back to the in-page sections, which still work.
function checkoutHref(pkg: Package | undefined, fallback: string): string {
  return pkg?.slug ? `/porudzbina/${pkg.slug}` : fallback;
}

function pickFeatured(items: Package[]): Package | undefined {
  return items.find((item) => item.highlighted) ?? items[0];
}

export default async function Home() {
  const [services, education, contact, copy, shots] = await Promise.all([
    getPublicPackages("services"),
    getPublicPackages("education"),
    getPublicContact(),
    getLandingContent(),
    getPublicResultShots(),
  ]);
  const projects = services.filter((item) => item.flow === "project");
  const clipPackages = projects.map(toClipPackage);
  const serviceHours = services.filter((item) => item.flow === "hours");
  const hourPacks = [...education, ...serviceHours].map(toHourPack);

  // The free brief — the funnel's real entry point, and what "Book a Call"
  // was gesturing at without linking to.
  const inquiryHref = checkoutHref(pickFeatured(projects), "#paketi");
  // A paid 1-on-1 hour, if the studio sells one. There is no calendar yet, so
  // this buys the hour and the term is agreed from the account.
  const consultPkg = pickFeatured(serviceHours) ?? pickFeatured(education);
  const consultHref = checkoutHref(consultPkg, "#edukacija");
  const consultLabel = consultPkg ? "Kupi sate 1-na-1" : "Privatna edukacija";

  return (
    <>
      <Preloader />
      <LatentBackground />
      <Nav ctaHref={inquiryHref} ctaLabel={copy.results_cta} />

      <main className="relative">
        <Hero
          primaryHref={inquiryHref}
          primaryLabel={copy.hero_cta_primary}
          secondaryHref="#paketi"
          secondaryLabel={copy.hero_cta_secondary}
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
            <div className="grid grid-cols-2 gap-x-8 gap-y-14 md:grid-cols-4">
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

        {/* Proof — pinned horizontal showcase */}
        <ResultsShowcase
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
          packages={clipPackages.length ? clipPackages : undefined}
          eyebrow={copy.packages_eyebrow}
          title={copy.packages_title}
          body={copy.packages_body}
          note={copy.packages_note}
        />

        {/* Edukacija — buy 1-on-1 hour packs (admin-driven, static fallback) */}
        <Education
          packs={hourPacks.length ? hourPacks : undefined}
          eyebrow={copy.education_eyebrow}
          title={copy.education_title}
          body={copy.education_body}
          pills={copy.education_pills}
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
                    Ili piši direktno na{" "}
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
            </Reveal>
          </div>
        </PinnedSection>
      </main>

      <Footer
        contact={contact}
        inquiryHref={inquiryHref}
        tagline={copy.footer_tagline}
        response={copy.footer_response}
      />
    </>
  );
}

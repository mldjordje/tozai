import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PortfolioGrid from "@/components/portfolio/PortfolioGrid";
import { getPublicPortfolio } from "@/lib/portfolio";
import { getPublicContact } from "@/lib/settings";
import { getLandingContent } from "@/lib/content/landing.server";
import { localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

// The published work, rendered once per language. Same shape as Landing: the
// route is thin, the locale is a prop, and every read takes it.

export default async function PortfolioPage({ locale }: { locale: Locale }) {
  const [portfolio, contact, copy] = await Promise.all([
    getPublicPortfolio(locale),
    getPublicContact(),
    getLandingContent(locale),
  ]);
  const t = ui(locale);

  // Same rule as the landing: a CTA that says "Pošalji upit" rather than naming
  // a service opens the general brief, where the buyer picks what it is for.
  const inquiryHref = localePath(locale, "/upit");

  return (
    <>
      <Nav locale={locale} ctaHref={inquiryHref} ctaLabel={copy.results_cta} />

      <main className="relative mx-auto min-h-svh w-full max-w-7xl px-6 pb-28 pt-32 md:px-12 md:pt-40">
        <p className="eyebrow mb-5">{t.portfolio.eyebrow}</p>
        <h1 className="display max-w-3xl text-4xl md:text-6xl">{t.portfolio.title}</h1>
        <p className="mb-14 mt-6 max-w-xl text-muted md:text-lg">{t.portfolio.lead}</p>

        <PortfolioGrid
          locale={locale}
          works={portfolio.works}
          categories={portfolio.categories}
        />
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

export function portfolioMetadata(locale: Locale) {
  return {
    title: "Portfolio — TOZA AI",
    description:
      locale === "en"
        ? "AI video work: Shorts, ads and UGC we made for clients."
        : "AI video radovi: Shorts, reklame i UGC koje smo napravili za klijente.",
    alternates: {
      canonical: localePath(locale, "/portfolio"),
      languages: { sr: "/portfolio", en: "/en/portfolio" },
    },
  };
}

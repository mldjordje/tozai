import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PortfolioGrid from "@/components/portfolio/PortfolioGrid";
import { getPublicPortfolio } from "@/lib/portfolio";
import { getPublicPackages, type Package } from "@/lib/packages";
import { getPublicContact } from "@/lib/settings";
import { getLandingContent } from "@/lib/content/landing.server";

// Admin writes revalidatePath("/portfolio"), so a newly published Short is live
// on the next request rather than after the window expires.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Portfolio — TOZA AI",
  description: "AI video radovi: Shorts, reklame i UGC koje smo napravili za klijente.",
};

function pickFeatured(items: Package[]): Package | undefined {
  return items.find((item) => item.highlighted) ?? items[0];
}

export default async function PortfolioPage() {
  const [portfolio, services, contact, copy] = await Promise.all([
    getPublicPortfolio(),
    getPublicPackages("services"),
    getPublicContact(),
    getLandingContent(),
  ]);

  // Same rule as the landing: every CTA has to land on something a buyer can
  // finish, derived from the packages table rather than hard-coded.
  const projects = services.filter((item) => item.flow === "project");
  const featured = pickFeatured(projects);
  const inquiryHref = featured?.slug ? `/porudzbina/${featured.slug}` : "/#paketi";

  return (
    <>
      <Nav ctaHref={inquiryHref} ctaLabel={copy.results_cta} />

      <main className="relative mx-auto min-h-svh w-full max-w-7xl px-6 pb-28 pt-32 md:px-12 md:pt-40">
        <p className="eyebrow mb-5">Portfolio</p>
        <h1 className="display max-w-3xl text-4xl md:text-6xl">Radovi koje smo pustili u svet.</h1>
        <p className="mb-14 mt-6 max-w-xl text-muted md:text-lg">
          Svaki klip je napravljen AI alatima, od scenarija do finalnog kadra. Klikni da pustiš.
        </p>

        <PortfolioGrid works={portfolio.works} categories={portfolio.categories} />
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

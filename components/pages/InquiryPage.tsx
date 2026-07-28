import Link from "next/link";
import VideoInquiryFlow from "@/components/checkout/VideoInquiryFlow";
import { getInquiryPackages } from "@/lib/inquiry";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProfile } from "@/lib/account";
import { localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

// The general way in.
//
// Every CTA that is not attached to one service — the header button, the hero,
// the proof rail, the footer — used to point at whichever project package
// happened to be featured, so a buyer who wanted avatars was handed a brief
// titled "AI Commercials" and had to notice the picker to fix it. Those CTAs
// land here instead: nothing is ticked, the picker is the first thing in the
// form, and /porudzbina/[slug] stays as the entry for someone who clicked a
// specific service and already knows what they want.
//
// Deliberately outside the middleware gate, same as the checkout: the write
// route (/api/nalog/video-zahtevi) is what needs a session, not the reading.

export default async function InquiryPage({ locale }: { locale: Locale }) {
  const [packages, user] = await Promise.all([
    getInquiryPackages(locale),
    getSessionUser(),
  ]);
  const profile = user ? await getProfile(user.uid) : null;
  const t = ui(locale).inquiry;

  return (
    <main className="relative min-h-svh px-6 pb-24 pt-28 md:px-12">
      {/* A single soft light, well away from the copy. The particle field would
          fight the form for attention; the brief should feel calm. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(60%_50%_at_80%_10%,rgba(74,118,216,0.10)_0%,transparent_70%)]"
      />

      <div className="mx-auto max-w-6xl">
        <Link
          href={localePath(locale, "/#paketi")}
          className="eyebrow transition-colors duration-300 hover:text-fg"
        >
          {t.backToPackages}
        </Link>

        <h1 className="display mt-7 max-w-3xl text-4xl md:text-6xl">
          {t.title} <em>{t.titleAccent}</em>.
        </h1>

        <VideoInquiryFlow
          locale={locale}
          packages={packages}
          nextPath={localePath(locale, "/upit")}
          user={user ? { email: user.email, name: user.name ?? null } : null}
          profile={
            profile
              ? {
                  name: profile.name,
                  phone: profile.phone,
                  isCompany: profile.is_company,
                  companyName: profile.company_name,
                  pib: profile.pib,
                  mb: profile.mb,
                  address: profile.address,
                  city: profile.city,
                  country: profile.country,
                }
              : null
          }
        />
      </div>
    </main>
  );
}

export function inquiryMetadata(locale: Locale) {
  return {
    title: locale === "en" ? "Send a brief — TOZA AI" : "Pošalji upit — TOZA AI",
    description:
      locale === "en"
        ? "Describe what you need and get a quote for AI video — price and turnaround land in your account."
        : "Opiši šta ti treba i dobij procenu za AI video — cena i rok stižu na tvoj nalog.",
    alternates: {
      canonical: localePath(locale, "/upit"),
      languages: { sr: "/upit", en: "/en/upit" },
    },
  };
}

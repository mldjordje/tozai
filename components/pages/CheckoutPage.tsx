import Link from "next/link";
import { notFound } from "next/navigation";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";
import VideoInquiryFlow from "@/components/checkout/VideoInquiryFlow";
import { getPackageBySlug } from "@/lib/packages";
import { getInquiryPackages } from "@/lib/inquiry";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProfile } from "@/lib/account";
import { paymentAvailability } from "@/lib/payments/provider";
import { localePath, type Locale } from "@/lib/i18n/config";
import { ui } from "@/lib/i18n/ui";

// Deliberately OUTSIDE the middleware gate. A buyer should be able to read the
// whole order before being asked to sign in — bouncing an anonymous visitor to
// a login screen the moment they click "Naruči" is where checkouts lose people.
// The write route (/api/nalog/porudzbina) is gated instead.
//
// Two flows behind one URL: a project package opens the brief (quoted by hand),
// an hours package opens the paid checkout. Only the brief is translated so
// far — the hours checkout still renders Serbian, which is why the English
// route is here but its packages are not linked from the English landing until
// that flow follows.

export default async function CheckoutPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const pkg = await getPackageBySlug(slug, locale);
  if (!pkg) notFound();

  const user = await getSessionUser();
  const profile = user ? await getProfile(user.uid) : null;
  const t = ui(locale).inquiry;

  // The buyer can swap this service or add more to the same brief, so the whole
  // quotable catalogue comes along. The requested one is prepended if the list
  // somehow misses it, so the page can never open with a ticked service that is
  // not in its own picker.
  const services = pkg.flow === "project" ? await getInquiryPackages(locale) : [];
  const inquirySlug = pkg.slug ?? slug;
  const inquiryPackages = services.some((item) => item.slug === inquirySlug)
    ? services
    : [
        {
          slug: inquirySlug,
          name: pkg.name,
          description: pkg.description,
          features: pkg.features,
        },
        ...services,
      ];

  return (
    <main className="relative min-h-svh px-6 pb-24 pt-28 md:px-12">
      {/* A single soft light, well away from the copy. The particle field would
          fight the form for attention; checkout should feel calm. */}
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
          {pkg.flow === "hours" ? (
            <>
              {locale === "en" ? "Buy " : "Kupovina "}
              <em>{locale === "en" ? "hours" : "sati"}</em>.
            </>
          ) : (
            <>
              {t.title} <em>{t.titleAccent}</em>.
            </>
          )}
        </h1>

        {pkg.flow === "project" ? (
          <VideoInquiryFlow
            locale={locale}
            packages={inquiryPackages}
            initialSlugs={[inquirySlug]}
            nextPath={localePath(locale, `/porudzbina/${inquirySlug}`)}
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
                  }
                : null
            }
          />
        ) : (
          <CheckoutFlow
            pkg={{
              slug: pkg.slug ?? slug,
              name: pkg.name,
              price: pkg.price,
              currency: pkg.currency,
              unit: pkg.unit,
              description: pkg.description,
              features: pkg.features,
              flow: pkg.flow,
              hours: pkg.hours,
            }}
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
            paymentAvailability={paymentAvailability()}
          />
        )}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";
import VideoInquiryFlow from "@/components/checkout/VideoInquiryFlow";
import { getPackageBySlug, getPublicPackages } from "@/lib/packages";
import { getSessionUser } from "@/lib/auth/user-session";
import { getProfile } from "@/lib/account";
import { paymentAvailability } from "@/lib/payments/provider";

// Deliberately OUTSIDE the middleware gate. A buyer should be able to read the
// whole order before being asked to sign in — bouncing an anonymous visitor to
// a login screen the moment they click "Naruči" is where checkouts lose people.
// The write route (/api/nalog/porudzbina) is gated instead.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Porudžbina — TOZA AI",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) notFound();

  const user = await getSessionUser();
  const profile = user ? await getProfile(user.uid) : null;

  // The brief lets the buyer switch service inside the form, so the whole
  // quotable catalogue comes along. Built from the same `packages` rows the
  // owner edits in /admin/paketi — a service added there shows up here without
  // a code change. The requested one is prepended if the list somehow misses
  // it, so the page can never render a picker without its own selection.
  const services =
    pkg.flow === "project"
      ? (await getPublicPackages())
          .filter((item) => item.flow === "project" && item.slug)
          .map((item) => ({
            slug: item.slug as string,
            name: item.name,
            description: item.description,
            features: item.features,
          }))
      : [];
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
          href="/#paketi"
          className="eyebrow transition-colors duration-300 hover:text-fg"
        >
          Nazad na pakete
        </Link>

        <h1 className="display mt-7 max-w-3xl text-4xl md:text-6xl">
          {pkg.flow === "hours" ? (
            <>
              Kupovina <em>sati</em>.
            </>
          ) : (
            <>
              Pošalji <em>upit</em>.
            </>
          )}
        </h1>

        {pkg.flow === "project" ? (
          <VideoInquiryFlow
            packages={inquiryPackages}
            initialSlug={inquirySlug}
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

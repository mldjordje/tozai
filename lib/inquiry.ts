import "server-only";
import { getPublicPackages } from "@/lib/packages";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

// The catalogue behind the brief.
//
// One brief can cover several services, so both routes that render the form —
// /upit and /porudzbina/[slug] — need the whole quotable list, not just the one
// in the URL. It is built from the same `packages` rows the owner edits in
// /admin/paketi, so adding a service there puts it in the picker without a code
// change; only `flow = 'project'` rows qualify, because hour packs are bought
// outright rather than quoted.

export type InquiryPackage = {
  slug: string;
  name: string;
  description: string | null;
  features: string[];
};

export async function getInquiryPackages(
  locale: Locale = DEFAULT_LOCALE,
): Promise<InquiryPackage[]> {
  const packages = await getPublicPackages(undefined, locale);
  return packages
    .filter((item) => item.flow === "project" && item.slug)
    .map((item) => ({
      slug: item.slug as string,
      name: item.name,
      description: item.description,
      features: item.features,
    }));
}

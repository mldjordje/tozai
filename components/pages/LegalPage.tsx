import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getLegalIdentity, getPublicContact } from "@/lib/settings";
import { getLandingContent } from "@/lib/content/landing.server";
import {
  LEGAL_UPDATED_AT,
  privacyPolicy,
  termsOfService,
  type LegalDocument,
} from "@/lib/content/legal";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * The two legal documents, rendered from one template.
 *
 * Plain and readable on purpose: these are the pages Google's OAuth review
 * opens, and the pages a buyer opens when they want to know what happens to
 * their data. Neither is served by the site's usual motion.
 */
export default async function LegalPage({
  locale,
  document: which,
}: {
  locale: Locale;
  document: "privacy" | "terms";
}) {
  const [identity, contact, copy] = await Promise.all([
    getLegalIdentity(),
    getPublicContact(),
    getLandingContent(locale),
  ]);

  const doc: LegalDocument =
    which === "privacy" ? privacyPolicy(identity, locale) : termsOfService(identity, locale);
  const inquiryHref = localePath(locale, "/upit");

  return (
    <>
      <Nav locale={locale} ctaHref={inquiryHref} ctaLabel={copy.results_cta} />

      <main className="relative z-10 min-h-screen select-text bg-bg px-6 pb-24 pt-32 md:px-12 md:pt-40">
        <article className="mx-auto max-w-3xl">
          <h1 className="display text-4xl md:text-6xl">{doc.title}</h1>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-faint">
            {doc.updatedLabel}: {LEGAL_UPDATED_AT}
          </p>
          <p className="mt-8 text-base leading-relaxed text-muted md:text-lg">{doc.lead}</p>

          <div className="mt-14 space-y-12">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
                  {section.heading}
                </h2>
                {section.body?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-4 text-sm leading-relaxed text-muted md:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-4 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="relative pl-5 text-sm leading-relaxed text-muted before:absolute before:left-0 before:top-2.5 before:size-1.5 before:rounded-full before:bg-accent md:text-base"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
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

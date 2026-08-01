"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { countryOptions, defaultCountry, isSerbia } from "@/lib/countries";
import { TIMEFRAMES, type Timeframe } from "@/lib/build-requests";
import {
  Area,
  EASE,
  Field,
  Note,
  Reveal,
  Select,
  Shell,
  digitsOnly,
  fixedDigits,
} from "@/components/checkout/fields";

/**
 * The brief that starts a web / app / automation job (grp='razvoj').
 *
 * Same shape as the video brief and posts into the same table, because
 * everything after a brief is identical: the studio quotes by hand, the buyer
 * accepts, that becomes an order and then a project. What differs is what has
 * to be asked, and that is the whole reason this is a second form rather than a
 * flag on the first one.
 *
 * WHY BUDGET IS OPTIONAL HERE AND REQUIRED ON THE VIDEO BRIEF. Somebody
 * ordering three clips knows roughly what clips cost. Somebody asking for a web
 * shop usually does not, and making them commit to a number they cannot
 * estimate is how that brief gets abandoned instead of sent. A blank budget is
 * a question for the first call, not a reason to lose the lead.
 *
 * WHY TIMEFRAME IS A SELECT. "When do you need it" typed free-form comes back
 * as "asap" and means nothing. Four buckets are enough to schedule against.
 */

type PackageSummary = {
  slug: string;
  name: string;
  description: string | null;
  features: string[];
};

type ProfileSummary = {
  name: string | null;
  phone: string | null;
  isCompany: boolean;
  companyName: string | null;
  pib: string | null;
  mb: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

/** Mirrors the server-side minimums in /api/nalog/razvoj-zahtevi. One object so
 *  the hint text, the counter and the check can never disagree. */
const MIN = {
  name: 2,
  businessName: 2,
  businessDescription: 30,
  idea: 50,
} as const;

/** Mirrors MAX_SERVICES_PER_REQUEST on the server. There are only three
 *  packages on this rail, so this is a ceiling rather than a real constraint. */
const MAX_SERVICES = 3;

const COPY = {
  sr: {
    backToPackages: "← Nazad na usluge",
    title: "Opiši",
    titleAccent: "projekat",
    signInEyebrow: "Prijava",
    signInTitle: "Prvo se prijavi",
    signInBody:
      "Upit se čuva na tvom nalogu — tamo stižu procena, rok i sve dalje poruke. Prijava traje deset sekundi.",
    signInCta: "Nastavi sa Google nalogom",
    signInNote: "Koristimo samo ime i mejl. Ne objavljujemo ništa i ne šaljemo newsletter.",
    formEyebrow: "Upit",
    formTitle: "Šta ti",
    formTitleAccent: "treba",
    formBody:
      "Što konkretnije opišeš, to je procena tačnija. Cena i rok stižu na tvoj nalog — do tada te ništa ne obavezuje.",
    services: "Usluga",
    servicesHint: "Izaberi šta ti treba. Možeš označiti više stvari u istom upitu.",
    servicesChosen: (count: number, max: number) => ` — izabrano ${count} / ${max}`,
    servicesRequired: "Izaberi bar jednu uslugu.",
    servicesFull: (max: number) => `Najviše ${max} usluge u jednom upitu.`,
    buyerType: "Naručilac",
    individual: "Fizičko lice",
    company: "Pravno lice",
    fullName: "Ime i prezime",
    contactPerson: "Kontakt osoba",
    phone: "Telefon",
    billingTitle: "Podaci za račun",
    billingBody:
      "Trebaju nam samo ako prihvatiš ponudu — tada se predračun izdaje odmah, bez dodatnog dopisivanja.",
    legalName: "Pun naziv firme",
    legalNamePlaceholder: "npr. Primer DOO Niš",
    pib: "PIB",
    pibHint: "9 cifara",
    mb: "Matični broj",
    mbHint: "8 cifara",
    address: "Adresa",
    addressPlaceholder: "Ulica i broj",
    city: "Grad",
    cityPlaceholder: "npr. Niš",
    country: "Država",
    countryForeignHint: "Predračun stiže na engleskom, sa IBAN/SWIFT podacima.",
    taxId: "Poreski broj (VAT / Tax ID)",
    taxIdPlaceholder: "npr. DE123456789",
    taxIdHint: "Opciono — možemo da ga tražimo kasnije.",
    business: "Naziv biznisa",
    businessPlaceholder: "Kako se zove tvoja firma ili brend",
    aboutBusiness: "O biznisu",
    aboutBusinessPlaceholder:
      "Čime se baviš, ko su ti kupci, kako trenutno dolaze do tebe…",
    aboutBusinessHint: "Bez ovoga procena je nagađanje.",
    idea: "Šta ti treba",
    ideaPlaceholder:
      "npr. Prodavnica sa oko 200 artikala, plaćanje karticom, povezivanje sa postojećim magacinom. Sadašnji sajt je star pet godina i ne radi na telefonu.",
    ideaHint: "Opiši problem koji rešavaš, ne samo alat koji želiš.",
    wishes: "Želje i funkcionalnosti",
    wishesPlaceholder:
      "npr. prijava korisnika, izveštaji, dve verzije jezika, povezivanje sa Instagramom, sajt koji ti se dopada kao primer…",
    wishesHint: "Opciono. Sve čega se setiš — lakše je precrtati nego dodati kasnije.",
    timeframe: "Vreme isporuke",
    timeframeHint: "Kada bi hteo da bude gotovo.",
    timeframes: {
      asap: "Što pre — hitno mi je",
      "1-3m": "U naredna 1–3 meseca",
      "3-6m": "U narednih 3–6 meseci",
      flex: "Nije hitno / fleksibilno",
    } as Record<Timeframe, string>,
    budget: "Budžet (EUR)",
    budgetHint: "Opciono. Ostavi prazno ako ne znaš — javićemo ti raspon.",
    nextTitle: "Šta se dešava dalje",
    nextBody:
      "Pregledamo upit i javljamo se sa procenom cene i roka. Sve stiže na tvoj nalog i mejlom. Do tada te ništa ne obavezuje.",
    submit: "Pošalji upit",
    submitting: "Šaljem…",
    submitNote: "Bez obaveze.",
    minChars: (min: number) => `Najmanje ${min} karaktera.`,
    sentEyebrow: (id: number) => `Upit #${id}`,
    sentTitle: "Upit je",
    sentTitleAccent: "stigao",
    sentBody:
      "Pregledamo šta si poslao i javljamo se sa procenom cene i roka. Sve dalje ide preko tvog naloga.",
    sentSteps: [
      "Pregledamo opis, želje i rok koji si naveo.",
      "Cena i vreme izrade stižu na tvoj nalog — javljamo ti mejlom.",
      "Tek tada odlučuješ da li prihvataš. Do tada te ništa ne obavezuje.",
    ],
    sentCta: "Prati status upita",
    summaryOne: "Upit za",
    summaryMany: "Upit za usluge",
    summaryEmpty: "Izaberi uslugu da vidiš detalje ovde.",
    changeService: "Promeni uslugu",
    pickService: "Izaberi uslugu",
    quoteTitle: "Privatna procena",
    quoteBody:
      "Cena zavisi od obima, pa se ne objavljuje na sajtu. Dobijaš je napisanu za tvoj projekat.",
    errors: {
      name: "Upiši ime i prezime.",
      country: "Izaberi državu.",
      companyName: "Upiši pun naziv firme.",
      pib: "PIB mora imati 9 cifara.",
      mb: "Matični broj mora imati 8 cifara.",
      address: "Upiši adresu.",
      city: "Upiši grad.",
      businessName: "Upiši naziv biznisa.",
      businessDescription: (min: number) => `Opiši biznis u bar ${min} karaktera.`,
      idea: (min: number) => `Opiši šta ti treba u bar ${min} karaktera.`,
      timeframe: "Izaberi vreme isporuke.",
      budget: "Budžet mora biti broj veći od nule, ili ostavi prazno.",
      generic: "Slanje nije uspelo. Pokušaj ponovo.",
      network: "Nema veze sa serverom. Proveri internet i pokušaj ponovo.",
    },
  },
  en: {
    backToPackages: "← Back to services",
    title: "Describe the",
    titleAccent: "project",
    signInEyebrow: "Sign in",
    signInTitle: "Sign in first",
    signInBody:
      "The brief is kept in your account — that is where the quote, the timeline and every later message land. Signing in takes ten seconds.",
    signInCta: "Continue with Google",
    signInNote: "We only use your name and email. Nothing is published and there is no newsletter.",
    formEyebrow: "Brief",
    formTitle: "What you",
    formTitleAccent: "need",
    formBody:
      "The more specific you are, the more accurate the quote. Price and timeline land in your account — nothing is binding until then.",
    services: "Service",
    servicesHint: "Pick what you need. One brief can cover several things.",
    servicesChosen: (count: number, max: number) => ` — ${count} / ${max} selected`,
    servicesRequired: "Pick at least one service.",
    servicesFull: (max: number) => `Up to ${max} services in one brief.`,
    buyerType: "Buyer",
    individual: "Individual",
    company: "Company",
    fullName: "Full name",
    contactPerson: "Contact person",
    phone: "Phone",
    billingTitle: "Invoice details",
    billingBody:
      "Only needed if you accept the quote — the proforma is then issued straight away, with no extra back and forth.",
    legalName: "Registered company name",
    legalNamePlaceholder: "e.g. Example Ltd",
    pib: "PIB",
    pibHint: "9 digits",
    mb: "Company number",
    mbHint: "8 digits",
    address: "Address",
    addressPlaceholder: "Street and number",
    city: "City",
    cityPlaceholder: "e.g. Berlin",
    country: "Country",
    countryForeignHint: "The proforma comes in English, with IBAN/SWIFT details.",
    taxId: "VAT / Tax ID",
    taxIdPlaceholder: "e.g. DE123456789",
    taxIdHint: "Optional — we can ask for it later.",
    business: "Business name",
    businessPlaceholder: "Your company or brand name",
    aboutBusiness: "About the business",
    aboutBusinessPlaceholder:
      "What you do, who your customers are, how they reach you today…",
    aboutBusinessHint: "Without this a quote is guesswork.",
    idea: "What you need",
    ideaPlaceholder:
      "e.g. A shop with around 200 products, card payments, connected to our existing warehouse. The current site is five years old and unusable on a phone.",
    ideaHint: "Describe the problem you are solving, not only the tool you want.",
    wishes: "Wishes and features",
    wishesPlaceholder:
      "e.g. user accounts, reports, two languages, Instagram integration, a site you like as a reference…",
    wishesHint: "Optional. Anything you can think of — easier to cut than to add later.",
    timeframe: "Delivery timeframe",
    timeframeHint: "When you would like it finished.",
    timeframes: {
      asap: "As soon as possible — urgent",
      "1-3m": "Within 1–3 months",
      "3-6m": "Within 3–6 months",
      flex: "Not urgent / flexible",
    } as Record<Timeframe, string>,
    budget: "Budget (EUR)",
    budgetHint: "Optional. Leave blank if you are not sure — we will send a range.",
    nextTitle: "What happens next",
    nextBody:
      "We read the brief and come back with a price and a timeline. Everything lands in your account and by email. Nothing is binding until then.",
    submit: "Send brief",
    submitting: "Sending…",
    submitNote: "No obligation.",
    minChars: (min: number) => `At least ${min} characters.`,
    sentEyebrow: (id: number) => `Brief #${id}`,
    sentTitle: "Your brief",
    sentTitleAccent: "arrived",
    sentBody:
      "We will read what you sent and come back with a price and a timeline. Everything else goes through your account.",
    sentSteps: [
      "We read the description, the wishes and the timeframe you gave.",
      "Price and delivery time land in your account — we email you.",
      "Only then do you decide. Nothing is binding until that point.",
    ],
    sentCta: "Track the brief",
    summaryOne: "Brief for",
    summaryMany: "Brief for services",
    summaryEmpty: "Pick a service to see the detail here.",
    changeService: "Change service",
    pickService: "Pick a service",
    quoteTitle: "Private quote",
    quoteBody:
      "The price depends on scope, so it is not published. You get one written for your project.",
    errors: {
      name: "Enter your full name.",
      country: "Pick a country.",
      companyName: "Enter the registered company name.",
      pib: "PIB must be 9 digits.",
      mb: "Company number must be 8 digits.",
      address: "Enter an address.",
      city: "Enter a city.",
      businessName: "Enter the business name.",
      businessDescription: (min: number) => `Describe the business in at least ${min} characters.`,
      idea: (min: number) => `Describe what you need in at least ${min} characters.`,
      timeframe: "Pick a delivery timeframe.",
      budget: "Budget must be a number above zero, or left blank.",
      generic: "Sending failed. Please try again.",
      network: "No connection to the server. Check your internet and try again.",
    },
  },
};

// Deliberately not `as const`: that would type every string as its own literal,
// and the English block would then fail to match a type derived from the
// Serbian one ("Sign in" is not assignable to "Prijava").
type T = (typeof COPY)["sr"];

const EMPTY = {
  buyerType: "individual" as "individual" | "company",
  name: "",
  phone: "",
  companyName: "",
  pib: "",
  mb: "",
  address: "",
  city: "",
  country: "",
  businessName: "",
  businessDescription: "",
  idea: "",
  wishes: "",
  timeframe: "" as "" | Timeframe,
  budgetEur: "",
};

type FormState = typeof EMPTY;
type FieldKey = keyof Omit<FormState, "buyerType">;

/** The order errors are walked in when the buyer submits an incomplete form,
 *  so the page scrolls to the first problem rather than an arbitrary one. */
const FIELD_ORDER: FieldKey[] = [
  "name",
  "country",
  "companyName",
  "pib",
  "mb",
  "address",
  "city",
  "businessName",
  "businessDescription",
  "idea",
  "timeframe",
  "budgetEur",
];

function validate(form: FormState, t: T): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (form.name.trim().length < MIN.name) {
    errors.name = t.errors.name;
  }
  if (!form.country.trim()) {
    errors.country = t.errors.country;
  }
  if (form.buyerType === "company") {
    if (form.companyName.trim().length < 2) {
      errors.companyName = t.errors.companyName;
    }
    // PIB and matični broj are issued by the Serbian register, so they are only
    // demanded of a Serbian company. Everyone else gives one free-form tax ID,
    // and optionally — a missing one is a question for the first call, not a
    // reason to lose the job at the form.
    if (isSerbia(form.country)) {
      if (!/^\d{9}$/.test(form.pib.trim())) {
        errors.pib = t.errors.pib;
      }
      if (!/^\d{8}$/.test(form.mb.trim())) {
        errors.mb = t.errors.mb;
      }
    }
    if (form.address.trim().length < 3) {
      errors.address = t.errors.address;
    }
    if (form.city.trim().length < 2) {
      errors.city = t.errors.city;
    }
  }
  if (form.businessName.trim().length < MIN.businessName) {
    errors.businessName = t.errors.businessName;
  }
  if (form.businessDescription.trim().length < MIN.businessDescription) {
    errors.businessDescription = t.errors.businessDescription(MIN.businessDescription);
  }
  if (form.idea.trim().length < MIN.idea) {
    errors.idea = t.errors.idea(MIN.idea);
  }
  if (!form.timeframe) {
    errors.timeframe = t.errors.timeframe;
  }
  // Blank is the documented answer, not an omission. Only a value that was
  // typed and is nonsense counts as an error.
  if (form.budgetEur.trim()) {
    const budget = Number(form.budgetEur);
    if (!Number.isFinite(budget) || budget <= 0) {
      errors.budgetEur = t.errors.budget;
    }
  }
  return errors;
}

export default function BuildInquiryFlow({
  packages,
  initialSlugs = [],
  nextPath,
  locale = DEFAULT_LOCALE,
  user,
  profile,
}: {
  /** Every web/app service the studio currently lists (admin → Paketi). */
  packages: PackageSummary[];
  initialSlugs?: string[];
  /** Where Google sends the buyer back to. This flow renders on two routes. */
  nextPath: string;
  locale?: Locale;
  user: { email: string; name: string | null } | null;
  profile: ProfileSummary | null;
}) {
  const copy: T = COPY[locale === "en" ? "en" : "sr"];
  const [selected, setSelected] = useState<string[]>(() =>
    initialSlugs.filter((slug) => packages.some((item) => item.slug === slug)),
  );
  const chosen = packages.filter((item) => selected.includes(item.slug));
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    buyerType: profile?.isCompany ? "company" : "individual",
    name: profile?.name ?? user?.name ?? "",
    phone: profile?.phone ?? "",
    companyName: profile?.companyName ?? "",
    pib: profile?.pib ?? "",
    mb: profile?.mb ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? defaultCountry(locale),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const servicesRef = useRef<HTMLDivElement | null>(null);

  const errors = validate(form, copy);
  const noService = selected.length === 0;
  const domestic = isSerbia(form.country);
  // Counts what is actually required of *this* buyer: a foreign company is
  // asked for two fewer things than a Serbian one, so a fixed total would stick
  // below 100% for someone who has finished. Budget is excluded — it is
  // optional, and a bar that never reaches full is worse than no bar.
  const requiredCount = (form.buyerType === "company" ? (domestic ? 11 : 9) : 6) + 1;
  const outstanding =
    FIELD_ORDER.filter((key) => key !== "budgetEur" && errors[key]).length +
    (noService ? 1 : 0);
  const progress = Math.max(
    0,
    Math.round(((requiredCount - outstanding) / requiredCount) * 100),
  );

  const toggleService = (slug: string) =>
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length >= MAX_SERVICES
          ? current
          : [...current, slug],
    );

  const set =
    (key: FieldKey, transform?: (value: string) => string) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value = transform ? transform(event.target.value) : event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
    };

  const blur = (key: FieldKey) => () => setTouched((t) => ({ ...t, [key]: true }));

  /** An error is only shown once the buyer has left the field, or once they
   *  have tried to submit — nagging while someone is still typing the first
   *  word is what makes forms feel hostile. */
  const errorFor = (key: FieldKey) =>
    showAll || touched[key] ? errors[key] : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const problems = validate(form, copy);
    if (selected.length === 0) {
      setShowAll(true);
      servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (Object.keys(problems).length > 0) {
      setShowAll(true);
      const first = FIELD_ORDER.find((key) => problems[key]);
      if (first) {
        const node = fieldRefs.current[first];
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        (node?.querySelector("input, textarea, select") as HTMLElement | null)?.focus({
          preventScroll: true,
        });
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/nalog/razvoj-zahtevi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugs: selected,
          ...form,
          // Blank stays blank all the way to a NULL column rather than becoming
          // a zero the studio would read as "this buyer has no money".
          budgetEur: form.budgetEur.trim() ? Number(form.budgetEur) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.message ?? copy.errors.generic);
        return;
      }
      setRequestId(data.requestId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(copy.errors.network);
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------- signed out */

  if (!user) {
    return (
      <Reveal>
        <div className="mt-10 max-w-xl md:mt-14">
          <p className="eyebrow">{copy.signInEyebrow}</p>
          <h2 className="display mt-5 text-3xl md:text-5xl">{copy.signInTitle}</h2>
          <p className="mt-5 leading-relaxed text-muted">{copy.signInBody}</p>
          <a
            href={`/api/auth/google?next=${encodeURIComponent(nextPath)}`}
            className="mt-9 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-fg px-7 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white active:scale-[0.99] sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.6 4.02-5.27 4.02-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.9 14.68 3 12.18 3 7.03 3 2.86 7.16 2.86 12.3s4.17 9.3 9.32 9.3c5.38 0 8.94-3.78 8.94-9.11 0-.61-.07-1.08-.17-1.39z"
              />
            </svg>
            {copy.signInCta}
          </a>
          <p className="mt-5 text-xs leading-relaxed text-faint">{copy.signInNote}</p>
        </div>
      </Reveal>
    );
  }

  /* ------------------------------------------------------------------ sent */

  if (requestId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mt-14 max-w-2xl"
      >
        <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev/50 p-7 backdrop-blur-md sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[color:var(--color-accent)] opacity-[0.13] blur-3xl"
          />
          <p className="eyebrow">{copy.sentEyebrow(requestId)}</p>
          <h2 className="display mt-5 text-3xl sm:text-4xl md:text-5xl">
            {copy.sentTitle} <em>{copy.sentTitleAccent}</em>.
          </h2>
          <p className="mt-5 leading-relaxed text-muted">{copy.sentBody}</p>

          <ol className="mt-8 space-y-4 border-t border-line pt-7">
            {copy.sentSteps.map((step, i) => (
              <li key={step} className="flex gap-4 text-sm text-muted">
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs tabular-nums text-faint">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href="/nalog/zahtevi"
            className="mt-9 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-fg px-7 text-sm font-medium text-bg transition-colors duration-300 hover:bg-white sm:w-auto"
          >
            {copy.sentCta}
          </a>
        </div>
      </motion.div>
    );
  }

  /* ------------------------------------------------------------------ form */

  return (
    <Shell
      aside={
        <Summary
          copy={copy}
          chosen={chosen}
          onChange={() =>
            servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        />
      }
    >
      <form onSubmit={submit} noValidate className="pb-28 lg:pb-0">
        <Reveal>
          <p className="eyebrow">{copy.formEyebrow}</p>
          <h2 className="display mt-5 text-3xl sm:text-4xl md:text-5xl">
            {copy.formTitle} <em>{copy.formTitleAccent}</em>.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
            {copy.formBody}
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 overflow-hidden bg-line">
              <motion.div
                className="h-px bg-[color:var(--color-accent-soft)]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
            <span className="text-xs tabular-nums text-faint">{progress}%</span>
          </div>
        </Reveal>

        <div className="mt-10 space-y-9">
          <Reveal delay={0.08}>
            <div ref={servicesRef} className="scroll-mt-24">
              <ServicePicker
                copy={copy}
                packages={packages}
                selected={selected}
                onToggle={toggleService}
                error={showAll && noService ? copy.servicesRequired : undefined}
              />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <fieldset>
              <legend className="text-xs uppercase tracking-[0.18em] text-faint">
                {copy.buyerType}
              </legend>
              <div className="mt-3.5 inline-flex rounded-full border border-line bg-bg-elev/40 p-1 backdrop-blur-sm">
                {[
                  { value: "individual", label: copy.individual },
                  { value: "company", label: copy.company },
                ].map((option) => {
                  const active = form.buyerType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          buyerType: option.value as FormState["buyerType"],
                        }))
                      }
                      className="relative min-h-11 rounded-full px-5 text-sm transition-colors duration-300"
                    >
                      {active && (
                        <motion.span
                          layoutId="build-buyer-type-pill"
                          className="absolute inset-0 rounded-full bg-fg"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={`relative z-10 ${active ? "text-bg" : "text-muted"}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="grid gap-9 sm:grid-cols-2">
              <Field
                label={copy.fullName}
                required
                value={form.name}
                onChange={set("name")}
                onBlur={blur("name")}
                placeholder={copy.contactPerson}
                error={errorFor("name")}
                innerRef={(node) => (fieldRefs.current.name = node)}
              />
              <Field
                label={copy.phone}
                value={form.phone}
                onChange={set("phone")}
                inputMode="tel"
                placeholder="+381 60 000 0000"
              />
            </div>
          </Reveal>

          {/* Decides which invoice template the buyer gets if they accept:
              Serbia the domestic proforma, anywhere else the English one with
              IBAN/SWIFT. Asked of individuals too — a private buyer abroad
              needs the foreign document just as much. */}
          <Reveal delay={0.13}>
            <Select
              label={copy.country}
              required
              value={form.country}
              onChange={set("country")}
              onBlur={blur("country")}
              options={countryOptions(locale)}
              hint={domestic ? undefined : copy.countryForeignHint}
              error={errorFor("country")}
              innerRef={(node) => (fieldRefs.current.country = node)}
            />
          </Reveal>

          <AnimatePresence initial={false}>
            {form.buyerType === "company" && (
              <motion.div
                key="company-billing"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-line bg-bg-elev/30 p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
                    {copy.billingTitle}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {copy.billingBody}
                  </p>
                  <div className="mt-7 space-y-7">
                    <Field
                      label={copy.legalName}
                      required
                      value={form.companyName}
                      onChange={set("companyName")}
                      onBlur={blur("companyName")}
                      placeholder={copy.legalNamePlaceholder}
                      error={errorFor("companyName")}
                      innerRef={(node) => (fieldRefs.current.companyName = node)}
                    />
                    {domestic ? (
                      <div className="grid gap-7 sm:grid-cols-2">
                        <Field
                          label={copy.pib}
                          required
                          value={form.pib}
                          onChange={set("pib", (value) => fixedDigits(value, 9))}
                          onBlur={blur("pib")}
                          inputMode="numeric"
                          placeholder={copy.pibHint}
                          hint={copy.pibHint}
                          error={errorFor("pib")}
                          innerRef={(node) => (fieldRefs.current.pib = node)}
                        />
                        <Field
                          label={copy.mb}
                          required
                          value={form.mb}
                          onChange={set("mb", (value) => fixedDigits(value, 8))}
                          onBlur={blur("mb")}
                          inputMode="numeric"
                          placeholder={copy.mbHint}
                          hint={copy.mbHint}
                          error={errorFor("mb")}
                          innerRef={(node) => (fieldRefs.current.mb = node)}
                        />
                      </div>
                    ) : (
                      <Field
                        label={copy.taxId}
                        value={form.pib}
                        onChange={set("pib")}
                        onBlur={blur("pib")}
                        placeholder={copy.taxIdPlaceholder}
                        hint={copy.taxIdHint}
                        error={errorFor("pib")}
                        innerRef={(node) => (fieldRefs.current.pib = node)}
                      />
                    )}
                    <div className="grid gap-7 sm:grid-cols-2">
                      <Field
                        label={copy.address}
                        required
                        value={form.address}
                        onChange={set("address")}
                        onBlur={blur("address")}
                        placeholder={copy.addressPlaceholder}
                        error={errorFor("address")}
                        innerRef={(node) => (fieldRefs.current.address = node)}
                      />
                      <Field
                        label={copy.city}
                        required
                        value={form.city}
                        onChange={set("city")}
                        onBlur={blur("city")}
                        placeholder={copy.cityPlaceholder}
                        error={errorFor("city")}
                        innerRef={(node) => (fieldRefs.current.city = node)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Reveal delay={0.14}>
            <Field
              label={copy.business}
              required
              value={form.businessName}
              onChange={set("businessName")}
              onBlur={blur("businessName")}
              placeholder={copy.businessPlaceholder}
              error={errorFor("businessName")}
              innerRef={(node) => (fieldRefs.current.businessName = node)}
            />
          </Reveal>

          <Reveal delay={0.18}>
            <Area
              label={copy.aboutBusiness}
              required
              value={form.businessDescription}
              onChange={set("businessDescription")}
              onBlur={blur("businessDescription")}
              placeholder={copy.aboutBusinessPlaceholder}
              rows={4}
              min={MIN.businessDescription}
              minChars={copy.minChars}
              hint={copy.aboutBusinessHint}
              error={errorFor("businessDescription")}
              innerRef={(node) => (fieldRefs.current.businessDescription = node)}
            />
          </Reveal>

          <Reveal delay={0.22}>
            <Area
              label={copy.idea}
              required
              value={form.idea}
              onChange={set("idea")}
              onBlur={blur("idea")}
              placeholder={copy.ideaPlaceholder}
              rows={6}
              min={MIN.idea}
              minChars={copy.minChars}
              hint={copy.ideaHint}
              error={errorFor("idea")}
              innerRef={(node) => (fieldRefs.current.idea = node)}
            />
          </Reveal>

          {/* Optional, and deliberately open: this is where a buyer lists the
              five things they would otherwise remember one at a time over the
              next fortnight. `min={0}` drops the counter — a "0 / 0" above an
              optional box reads as a requirement nobody set. */}
          <Reveal delay={0.24}>
            <Area
              label={copy.wishes}
              value={form.wishes}
              onChange={set("wishes")}
              placeholder={copy.wishesPlaceholder}
              rows={4}
              min={0}
              minChars={copy.minChars}
              hint={copy.wishesHint}
            />
          </Reveal>

          <Reveal delay={0.26}>
            <div className="grid gap-9 sm:grid-cols-2">
              <Select
                label={copy.timeframe}
                required
                value={form.timeframe}
                onChange={set("timeframe")}
                onBlur={blur("timeframe")}
                options={[
                  { value: "", label: "—" },
                  ...TIMEFRAMES.map((key) => ({
                    value: key,
                    label: copy.timeframes[key],
                  })),
                ]}
                hint={copy.timeframeHint}
                error={errorFor("timeframe")}
                innerRef={(node) => (fieldRefs.current.timeframe = node)}
              />
              <Field
                label={copy.budget}
                value={form.budgetEur}
                onChange={set("budgetEur", digitsOnly)}
                onBlur={blur("budgetEur")}
                inputMode="numeric"
                placeholder="—"
                hint={copy.budgetHint}
                error={errorFor("budgetEur")}
                innerRef={(node) => (fieldRefs.current.budgetEur = node)}
              />
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-elev/40 p-5 backdrop-blur-sm sm:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[color:var(--color-accent)] opacity-[0.10] blur-3xl"
              />
              <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
                {copy.nextTitle}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{copy.nextBody}</p>
            </div>
          </Reveal>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              key="submit-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mt-7 rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* On a phone the action rides at the bottom of the screen so it is
            reachable from any scroll position; on desktop it sits in the flow. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 px-5 py-4 backdrop-blur-xl lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-2xl items-center gap-4 lg:mx-0">
            <button
              type="submit"
              disabled={busy}
              className="min-h-13 flex-1 rounded-full bg-fg px-8 py-3.5 text-sm font-medium text-bg transition-all duration-300 enabled:hover:bg-white enabled:active:scale-[0.99] disabled:opacity-50 lg:flex-none"
            >
              {busy ? copy.submitting : copy.submit}
            </button>
            <span className="hidden text-xs text-faint sm:block">{copy.submitNote}</span>
          </div>
        </div>
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ pieces */

/** Which services the brief covers. Rows rather than pricing cards: the landing
 *  already sold the service and there is no price to compare here anyway. */
function ServicePicker({
  copy,
  packages,
  selected,
  onToggle,
  error,
}: {
  copy: T;
  packages: PackageSummary[];
  selected: string[];
  onToggle: (slug: string) => void;
  error?: string;
}) {
  const full = selected.length >= MAX_SERVICES;
  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-[0.18em] text-faint">
        {copy.services}
        <span className="ml-1 text-accent-soft">*</span>
      </legend>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        {copy.servicesHint}
        {selected.length > 0 && (
          <span className="text-faint">
            {copy.servicesChosen(selected.length, MAX_SERVICES)}
          </span>
        )}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {packages.map((item) => {
          const active = selected.includes(item.slug);
          const blocked = !active && full;
          return (
            <button
              key={item.slug}
              type="button"
              role="checkbox"
              aria-checked={active}
              disabled={blocked}
              onClick={() => onToggle(item.slug)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300 ${
                active
                  ? "border-accent-soft/60 bg-bg-elev/60"
                  : blocked
                    ? "border-line bg-bg-elev/10 opacity-40"
                    : "border-line bg-bg-elev/20 hover:border-faint"
              }`}
            >
              {active && (
                <motion.span
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:var(--color-accent)] opacity-[0.16] blur-2xl"
                />
              )}
              <span className="relative flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.3rem] border transition-colors duration-300 ${
                    active
                      ? "border-accent-soft bg-[color:var(--color-accent-soft)]"
                      : "border-faint"
                  }`}
                >
                  {active && (
                    <motion.svg
                      viewBox="0 0 12 12"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="h-2.5 w-2.5 text-bg"
                      aria-hidden
                    >
                      <path
                        d="M2 6.2 4.6 8.8 10 3.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </motion.svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${active ? "text-fg" : "text-muted"}`}>
                    {item.name}
                  </span>
                  {item.description && (
                    <span className="mt-1.5 block text-xs leading-relaxed text-faint">
                      {item.description}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <Note error={error} hint={full ? copy.servicesFull(MAX_SERVICES) : undefined} />
    </fieldset>
  );
}

/** What the brief is currently for. Features are listed only when a single
 *  service is ticked — stacked feature lists in a sticky column are a wall. */
function Summary({
  copy,
  chosen,
  onChange,
}: {
  copy: T;
  chosen: PackageSummary[];
  onChange: () => void;
}) {
  const single = chosen.length === 1 ? chosen[0] : null;
  return (
    <aside>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative overflow-hidden rounded-3xl border border-line bg-bg-elev/40 p-6 backdrop-blur-md sm:p-7 lg:sticky lg:top-28"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[color:var(--color-accent)] opacity-[0.12] blur-3xl"
        />
        <p className="eyebrow">
          {chosen.length > 1 ? copy.summaryMany : copy.summaryOne}
        </p>

        {chosen.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-muted">{copy.summaryEmpty}</p>
        ) : single ? (
          <>
            <h2 className="display mt-4 text-2xl">{single.name}</h2>
            {single.description && (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {single.description}
              </p>
            )}
            {single.features.length > 0 && (
              <ul className="mt-6 space-y-3 border-t border-line pt-6">
                {single.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-muted">
                    <span className="mt-2 h-px w-3 shrink-0 bg-faint" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <ul className="mt-5 space-y-3.5 border-t border-line pt-5">
            {chosen.map((item) => (
              <li key={item.slug} className="flex gap-3 text-sm text-fg">
                <span className="mt-2 h-px w-3 shrink-0 bg-accent-soft" />
                <span>
                  {item.name}
                  {item.description && (
                    <span className="mt-1 block text-xs leading-relaxed text-faint">
                      {item.description}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onChange}
          className="mt-6 inline-flex min-h-11 items-center rounded-full border border-line bg-bg-elev/50 px-5 text-sm text-muted transition-colors duration-300 hover:border-accent-soft hover:text-fg"
        >
          {chosen.length === 0 ? copy.pickService : copy.changeService}
        </button>

        <div className="mt-7 border-t border-line pt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">
            {copy.quoteTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-faint">{copy.quoteBody}</p>
        </div>
      </motion.div>
    </aside>
  );
}


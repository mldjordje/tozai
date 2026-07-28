"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { ui, type UiStrings } from "@/lib/i18n/ui";
import { countryOptions, defaultCountry, isSerbia } from "@/lib/countries";

type T = UiStrings["inquiry"];

/**
 * The brief that starts an AI video job. There is no price here on purpose —
 * the studio quotes each job by hand, so this form's only job is to collect
 * enough to quote from, and to make that obvious while the buyer types.
 *
 * WHY THE SIGNED-OUT SCREEN SHOWS NOTHING ELSE. Every "Pošalji upit" on the
 * landing arrives here, and most of the people who click it have no account. A
 * service card sitting above the sign-in button pushed the only useful control
 * off a phone screen, to describe a service the buyer had just read about one
 * click earlier. Signed out, this page is a sign-in screen and nothing more;
 * the service is chosen inside the form, where it can actually be changed.
 *
 * WHY SERVICES ARE A MULTI-SELECT. A buyer who wants commercials and avatars
 * used to have to send two briefs describing the same business twice, and the
 * studio quoted them as two unrelated jobs. One brief now carries the whole
 * list; the request keeps a primary package so the order and project it turns
 * into still point at one row, and `service_name` carries the joined label.
 *
 * WHY THE SUBMIT BUTTON IS NEVER DISABLED. It used to be, and on a phone that
 * read as a dead button: the minimums are invisible, so a buyer who wrote two
 * short sentences tapped a button that simply did nothing and left. Now the tap
 * always does something — it validates, scrolls to the first problem and says
 * what is missing. Live counters mean it rarely gets that far.
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

/** Mirrors the server-side minimums in /api/nalog/video-zahtevi. Kept here as
 *  one object so the hint text, the counter and the check can never disagree. */
const MIN = {
  name: 2,
  businessName: 2,
  businessDescription: 30,
  idea: 50,
} as const;

/** Mirrors MAX_SERVICES_PER_REQUEST on the server. Past four this stops being
 *  one brief the studio can price and starts being a catalogue. */
const MAX_SERVICES = 4;

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
  idea: "",
  clipCount: "3",
  businessName: "",
  businessDescription: "",
  budgetEur: "",
};

type FormState = typeof EMPTY;
type FieldKey = keyof Omit<FormState, "buyerType">;

const EASE = [0.16, 1, 0.3, 1] as const;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 7);
}

function fixedDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

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
    // A PIB and a matični broj are issued by the Serbian business register, so
    // they are only demanded of a Serbian company. A company anywhere else gives
    // a VAT / tax ID in whatever shape its own registry uses — and optionally,
    // because a missing one is a question the studio can ask later rather than a
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
  const clips = Number(form.clipCount);
  if (!Number.isInteger(clips) || clips < 1 || clips > 100) {
    errors.clipCount = t.errors.clipCount;
  }
  const budget = Number(form.budgetEur);
  if (!Number.isFinite(budget) || budget <= 0) {
    errors.budgetEur = t.errors.budget;
  }
  return errors;
}

export default function VideoInquiryFlow({
  packages,
  initialSlugs = [],
  nextPath,
  locale = DEFAULT_LOCALE,
  user,
  profile,
}: {
  /** Every AI video service the studio currently sells (admin → Paketi). */
  packages: PackageSummary[];
  /** Ticked on arrival — the service page passes its own, /upit passes none. */
  initialSlugs?: string[];
  /** Where Google sends the buyer back to. This flow renders on two routes. */
  nextPath: string;
  locale?: Locale;
  user: { email: string; name: string | null } | null;
  profile: ProfileSummary | null;
}) {
  const copy = ui(locale).inquiry;
  // Seeded from the URL, owned by the buyer from the first tap. A slug that has
  // since been retired is dropped rather than kept as a ghost the server would
  // reject on submit.
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
    // Serbia unless the buyer says otherwise — it is the overwhelming majority,
    // and a country nobody chose is what silently issued every foreign buyer a
    // domestic Serbian document.
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
  // A foreign company is asked for three fewer things than a Serbian one (no
  // PIB, no matični broj), so the bar has to count what is actually required of
  // *this* buyer — otherwise it sticks below 100% for someone who has finished.
  const domestic = isSerbia(form.country);
  const requiredCount =
    (form.buyerType === "company" ? (domestic ? 12 : 10) : 7) + 1;
  const progress = Math.round(
    ((requiredCount - Object.keys(errors).length - (noService ? 1 : 0)) / requiredCount) * 100,
  );

  /** Tick, untick, and refuse the tick that would push the brief past what the
   *  studio can quote as one job. Never empties to nothing by accident — the
   *  last remaining service is untickable, which is also what makes this a
   *  "change" control on a page that arrived with one already chosen. */
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
      const first = ([
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
        "clipCount",
        "budgetEur",
      ] as FieldKey[])
        .find((key) => problems[key]);
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
      const response = await fetch("/api/nalog/video-zahtevi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugs: selected,
          ...form,
          clipCount: Number(form.clipCount),
          budgetEur: Number(form.budgetEur),
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
          <h2 className="display mt-5 text-3xl md:text-5xl">
            {copy.signInTitle}
          </h2>
          <p className="mt-5 leading-relaxed text-muted">
            {copy.signInBody}
          </p>
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
          <p className="mt-5 text-xs leading-relaxed text-faint">
            {copy.signInNote}
          </p>
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
          <p className="mt-5 leading-relaxed text-muted">
            {copy.sentBody}
          </p>

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

        {/* Completeness, so the buyer can see the form filling up rather than
            guessing why the last step is not available yet. */}
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
                          layoutId="buyer-type-pill"
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

          {/* Where the buyer is. This is the field the whole document set hangs
              off: Serbia gets the domestic proforma with the dinar account and
              the domestic VAT note, anywhere else gets the English one with
              IBAN/SWIFT and the export note. Asked of individuals too — a
              private buyer abroad needs the foreign document just as much. */}
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
                    {/* A PIB and a matični broj exist only in the Serbian
                        register. A company outside it is asked for one free-form
                        tax ID, which prints under "Tax ID" on the English
                        document, and is not held up by a format it cannot meet. */}
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

          <Reveal delay={0.26}>
            <div className="grid gap-9 sm:grid-cols-2">
              <Field
                label={copy.clips}
                required
                value={form.clipCount}
                onChange={set("clipCount", digitsOnly)}
                onBlur={blur("clipCount")}
                inputMode="numeric"
                placeholder="npr. 3"
                hint={copy.clipsHint}
                error={errorFor("clipCount")}
                innerRef={(node) => (fieldRefs.current.clipCount = node)}
              />
              <Field
                label={copy.budget}
                required
                value={form.budgetEur}
                onChange={set("budgetEur", digitsOnly)}
                onBlur={blur("budgetEur")}
                inputMode="numeric"
                placeholder="npr. 800"
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
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {copy.nextBody}
              </p>
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
            <span className="hidden text-xs text-faint sm:block">
              {copy.submitNote}
            </span>
          </div>
        </div>
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ layout */

function Shell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <div className="order-2 max-w-2xl lg:order-1">{children}</div>
      <div className="order-1 lg:order-2">{aside}</div>
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Which AI video services the brief covers.
 *
 * Rows, not pricing cards: the landing already sold the service, and there is
 * no price to compare here anyway. All this has to do is show what is ticked
 * and make changing it a single tap — the aside carries the detail.
 *
 * Multi-select, so this control is both halves of what the page needs: on /upit
 * it is how the buyer picks anything at all, and on a single service page it is
 * how they swap that service or add a second one to the same brief.
 */
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
        {copy.services}<span className="ml-1 text-accent-soft">*</span>
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
          // A full list greys out what cannot be added, rather than letting the
          // tap do nothing and leaving the buyer to work out why.
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
      <Note
        error={error}
        hint={full ? copy.servicesFull(MAX_SERVICES) : undefined}
      />
    </fieldset>
  );
}

/**
 * What the brief is currently for.
 *
 * Features are listed only when a single service is ticked: four feature lists
 * stacked in a sticky column is a wall, and by the time someone is comparing
 * services they are reading the picker, not this.
 */
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
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {copy.summaryEmpty}
          </p>
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

        {/* The way out of a page that arrived with one service already chosen:
            nothing else on it says the brief can carry more than that one. */}
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
          <p className="mt-2 text-sm leading-relaxed text-faint">
            {copy.quoteBody}
          </p>
        </div>
      </motion.div>
    </aside>
  );
}

/* ------------------------------------------------------------------ inputs */

function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-xs uppercase tracking-[0.18em] text-faint">
      {label}
      {required && <span className="ml-1 text-accent-soft">*</span>}
    </span>
  );
}

function Note({ error, hint }: { error?: string; hint?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {(error || hint) && (
        <motion.span
          key={error ? "err" : "hint"}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`mt-2 block text-xs leading-relaxed ${error ? "text-red-300" : "text-faint"}`}
        >
          {error ?? hint}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  error,
  required,
  inputMode,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  inputMode?: "text" | "numeric" | "tel";
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <label ref={innerRef} className="block scroll-mt-24">
      <Label label={label} required={required} />
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className="field mt-3"
      />
      <Note error={error} hint={hint} />
    </label>
  );
}

/**
 * A native <select>, styled as one of the fields.
 *
 * Native rather than a custom listbox: sixty-odd countries is exactly the case
 * where a phone's own picker — searchable, scrollable with one thumb, already
 * familiar — beats anything rebuilt in a div. The only thing worth overriding
 * is the arrow, so it matches the rest of the form rather than the OS.
 */
function Select({
  label,
  value,
  onChange,
  onBlur,
  options,
  hint,
  error,
  required,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
  required?: boolean;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <label ref={innerRef} className="block max-w-sm scroll-mt-24">
      <Label label={label} required={required} />
      <div className="relative mt-3">
        <select
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          className="field appearance-none pr-11"
        >
          {/* A value the list does not know about — an older profile row typed
              by hand — keeps its own option, so opening the form never silently
              rewrites what the buyer told us before. */}
          {options.some((option) => option.value === value) ? null : (
            <option value={value}>{value}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <Note error={error} hint={hint} />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  rows,
  min,
  minChars,
  hint,
  error,
  required,
  innerRef,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder: string;
  rows: number;
  min: number;
  minChars: (min: number) => string;
  hint?: string;
  error?: string;
  required?: boolean;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  const length = value.trim().length;
  const reached = length >= min;
  return (
    <label ref={innerRef} className="block scroll-mt-24">
      <span className="flex items-baseline justify-between gap-4">
        <Label label={label} required={required} />
        <span
          className={`text-xs tabular-nums transition-colors duration-300 ${
            reached ? "text-accent-soft" : "text-faint"
          }`}
        >
          {reached ? `${length}` : `${length} / ${min}`}
        </span>
      </span>
      <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className="field mt-3"
      />
      <Note error={error} hint={hint ? `${minChars(min)} ${hint}` : undefined} />
    </label>
  );
}
